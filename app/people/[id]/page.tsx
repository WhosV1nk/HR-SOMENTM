import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar, 
  Shield, 
  Award, 
  CheckCircle2, 
  Circle, 
  FileText, 
  Edit3, 
  Clock, 
  TrendingUp, 
  CalendarDays,
  UserX,
  UserCheck,
  CheckSquare
} from "lucide-react";

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: person } = await supabase.from("people").select("*").eq("id", id).single();

  if (!person) {
    notFound();
  }

  // Server Action: Complete Onboarding Workflow
  async function completeOnboardingAction() {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    await supabase.from("people").update({
      status: "Active",
      onboarding_progress: 100
    }).eq("id", id);

    revalidatePath(`/people/${id}`);
    revalidatePath("/people");
    revalidatePath("/");
  }

  // Server Action: Controlled Deactivation (Soft Archive)
  async function deactivatePersonAction(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const isIntern = person.person_type === "Intern";
    const targetStatus = isIntern ? "Completed" : "Terminated";

    await supabase.from("people").update({
      status: targetStatus
    }).eq("id", id);

    revalidatePath(`/people/${id}`);
    revalidatePath("/people");
    revalidatePath("/");
    redirect("/people");
  }

  // Server Action: Reactivate
  async function reactivatePersonAction() {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    await supabase.from("people").update({
      status: "Active"
    }).eq("id", id);

    revalidatePath(`/people/${id}`);
    revalidatePath("/people");
    revalidatePath("/");
  }

  const adminSupabase = createAdminClient();

  const [
    { data: attendance },
    { data: leaves },
    { data: reviews },
    { data: tasks },
    { data: onboardingSub },
    { data: onboardingTok }
  ] = await Promise.all([
    supabase.from("attendance").select("*").eq("person_id", person.id).order("date", { ascending: false }).limit(10),
    supabase.from("leave_requests").select("*").eq("person_id", person.id).order("start_date", { ascending: false }),
    supabase.from("performance_reviews").select("*").eq("person_id", person.id).order("created_at", { ascending: false }),
    supabase.from("intern_tasks").select("*").eq("intern_id", person.id).order("due_date", { ascending: false }),
    adminSupabase.from("onboarding_submissions").select("*").eq("person_id", person.id).maybeSingle(),
    adminSupabase.from("onboarding_tokens").select("*").eq("person_id", person.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  let activeToken = onboardingTok?.token;
  if (!activeToken && person.status !== "Completed" && person.status !== "Terminated") {
    const crypto = await import("crypto");
    const generatedToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: createdTok } = await adminSupabase.from("onboarding_tokens").insert({
      person_id: person.id,
      token: generatedToken,
      expires_at: expiresAt,
      used: false
    }).select("token").single();
    if (createdTok?.token) {
      activeToken = createdTok.token;
    }
  }
  const totalAtt = attendance?.length || 0;
  const presentCount = attendance?.filter(a => a.status === "Present" || a.status === "Late").length || 0;
  const lateCount = attendance?.filter(a => a.status === "Late").length || 0;
  const absentCount = attendance?.filter(a => a.status === "Absent").length || 0;
  const attRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : "—";

  // Dynamic 7-stage onboarding checklist calculation (Person vs HR owned steps)
  const isFounder = person.employment_type === "Founder" || person.person_type === "Founder";
  const hasDetails = Boolean(person.phone && person.dob && person.address);
  const hasEmergency = Boolean(person.emergency_contact);
  const isAgreementSigned = isFounder || Boolean(onboardingSub?.agreement_signed) || person.status === "Active";
  const isDocVerified = isFounder || onboardingSub?.identity_doc_status === "Verified" || person.status === "Active";

  const onboardingChecklist = [
    { label: "Account created & SOMENTM ID assigned", done: true, owner: "HR" },
    { label: "Invitation email accepted / token accessed", done: Boolean(onboardingTok?.used || onboardingSub), owner: "Person" },
    { label: "Personal & contact information completed", done: hasDetails, owner: "Person" },
    { label: "Emergency contact details provided", done: hasEmergency, owner: "Person" },
    { label: "Employment terms & agreement signed", done: isAgreementSigned, owner: "Person" },
    { label: "Identity proof verified by HR", done: isDocVerified, owner: "HR" },
    { label: "Final HR approval & active status", done: person.status === "Active", owner: "HR" }
  ];
  
  const completedCount = onboardingChecklist.filter(s => s.done).length;
  const onboardingPercentage = Math.round((completedCount / onboardingChecklist.length) * 100);
  const isReadyToComplete = completedCount >= 6 && person.status !== "Active";

  const latestReview = reviews && reviews.length > 0 ? reviews[0] : null;

  return (
    <div className="p-8 pb-20 max-w-6xl mx-auto space-y-8">
      {/* Back button & Action Toolbar */}
      <div className="flex justify-between items-center">
        <Link href="/people" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white transition-colors">
          <ArrowLeft size={16} /> Back to Directory
        </Link>
        <div className="flex items-center gap-3">
          <button className="btn-secondary text-xs flex items-center gap-2">
            <Edit3 size={14} /> Edit Profile
          </button>
          
          {person.status === "Active" ? (
            <form action={deactivatePersonAction}>
              <button type="submit" className="btn-ghost text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5">
                <UserX size={14} /> {person.person_type === "Intern" ? "Complete Internship" : "Deactivate Person"}
              </button>
            </form>
          ) : (
            <form action={reactivatePersonAction}>
              <button type="submit" className="btn-ghost text-xs text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5">
                <UserCheck size={14} /> Reactivate Profile
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="card p-6 bg-surface/80 relative overflow-hidden border-l-4 border-l-red-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl font-bold text-red-400">
              {person.first_name[0]}{person.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{person.first_name} {person.last_name}</h1>
                <span className="font-mono text-xs text-muted px-2.5 py-1 bg-surface-3 rounded-lg border border-border">
                  {person.employee_id}
                </span>
              </div>
              <p className="text-sm text-muted mt-1">{person.role} • <span className="capitalize">{person.department}</span></p>
              
              {/* Separate Active Employment Status from Onboarding */}
              <div className="flex items-center gap-3 mt-3 text-xs">
                {person.status === "Active" && <span className="badge-success">🟢 Active</span>}
                {person.status === "Onboarding" && <span className="badge-warning">🟡 Onboarding</span>}
                {person.status === "Completed" && <span className="badge-secondary">🔵 Internship Completed</span>}
                {person.status === "Terminated" && <span className="badge-danger">🔴 Inactive / Terminated</span>}
                
                <span className="badge-secondary uppercase tracking-wider text-[10px] font-semibold">{person.employment_type || person.person_type}</span>
                <span className="text-muted text-[11px]">Onboarding: {onboardingPercentage}%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted">
            <div className="flex items-center gap-2"><Mail size={14} className="text-red-400" /> {person.email}</div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-red-400" /> 
              {person.phone || "Phone not added"}
            </div>
            <div className="flex items-center gap-2"><Calendar size={14} className="text-red-400" /> Joined {person.joined_date || "2026-10-04"}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Employment & Controlled Onboarding */}
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-border/40 pb-3">
              Employment Details
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-border/20">
                <span className="text-muted">SOMENTM ID</span>
                <span className="font-mono font-semibold text-text">{person.employee_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/20">
                <span className="text-muted">Department</span>
                <span className="font-medium text-text capitalize">{person.department}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/20">
                <span className="text-muted">Role</span>
                <span className="font-medium text-text">{person.role}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/20">
                <span className="text-muted">Type</span>
                <span className="font-medium text-text">{person.employment_type || person.person_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/20">
                <span className="text-muted">Employment Status</span>
                <span className={`font-semibold ${person.status === 'Active' ? 'text-emerald-400' : 'text-amber-400'}`}>{person.status}</span>
              </div>
              {person.person_type === "Intern" && (
                <>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted">Cohort</span>
                    <span className="font-medium text-text">{person.cohort || "Summer 2026"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted">Duration</span>
                    <span className="font-medium text-text">{person.start_date || "Jul 17"} to {person.end_date || "Jan 16"}</span>
                  </div>
                </>
              )}
              {onboardingSub?.student_id_doc_name && (
                <div className="flex justify-between py-1 border-b border-border/20 items-center">
                  <span className="text-muted">Student ID</span>
                  <span className="font-mono text-emerald-400 flex items-center gap-1 text-[11px]">
                    📄 {onboardingSub.student_id_doc_name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Controlled Onboarding Workflow */}
          <div className="card p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Onboarding Checklist
              </h2>
              <span className="text-xs font-mono font-bold text-amber-400">{completedCount}/7 ({onboardingPercentage}%)</span>
            </div>
            <div className="w-full bg-surface-3 rounded-full h-2">
              <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${onboardingPercentage}%` }}></div>
            </div>
            
            <div className="space-y-2.5 text-xs">
              {onboardingChecklist.map((stage, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 ${stage.done ? 'text-emerald-400' : 'text-muted'}`}>
                    {stage.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <span>{stage.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted/60">{stage.owner}</span>
                </div>
              ))}
            </div>

            {/* Onboarding Token Link (for Candidate self-service or HR copy) */}
            {activeToken ? (
              <div className="p-3 bg-surface-2 rounded-lg border border-border/40 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-semibold text-muted tracking-wider">Candidate Portal Link:</span>
                  {onboardingTok?.used && (
                    <span className="text-[10px] text-emerald-400 font-medium">Submitted</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    readOnly 
                    value={`/onboarding/${activeToken}`} 
                    className="bg-surface-3 text-[11px] font-mono px-2 py-1 rounded w-full border border-border/40 text-muted" 
                  />
                  <Link 
                    href={`/onboarding/${activeToken}`} 
                    target="_blank"
                    className="text-xs text-red-400 font-semibold shrink-0 hover:underline"
                  >
                    Open →
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Complete Onboarding HR Action Button */}
            {person.status === "Onboarding" && (
              <div className="pt-2 border-t border-border/40">
                <form action={completeOnboardingAction}>
                  <button 
                    type="submit" 
                    disabled={!isReadyToComplete}
                    className={`btn-primary w-full justify-center text-xs py-2 flex items-center gap-2 ${
                      !isReadyToComplete ? 'opacity-50 cursor-not-allowed bg-surface-3 text-muted border-border hover:bg-surface-3' : ''
                    }`}
                  >
                    <CheckSquare size={14} /> Complete Onboarding & Activate
                  </button>
                </form>
                {!isReadyToComplete && (
                  <p className="text-[10px] text-muted text-center mt-2">
                    Candidate must complete portal submission before activation.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Leave Summary */}
          <div className="card p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-border/40 pb-2">
              <h2 className="text-sm font-semibold text-white">Leave Balance</h2>
              <Link href="/leave" className="text-xs text-red-400">View All</Link>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-surface-2">
                <div className="text-muted text-[10px]">Casual</div>
                <div className="font-bold text-text mt-1">8 / 12</div>
              </div>
              <div className="p-2 rounded-lg bg-surface-2">
                <div className="text-muted text-[10px]">Sick</div>
                <div className="font-bold text-text mt-1">6 / 10</div>
              </div>
              <div className="p-2 rounded-lg bg-surface-2">
                <div className="text-muted text-[10px]">Earned</div>
                <div className="font-bold text-text mt-1">12 / 18</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Attendance, Performance & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Attendance Summary & History Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-border/50 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold text-white">Attendance Summary & Logs</h2>
                <div className="text-xs text-muted flex items-center gap-3 mt-1">
                  <span>Present Rate: <strong className="text-emerald-400">{attRate}{attRate !== "—" ? "%" : ""}</strong></span>
                  <span>Late: <strong className="text-amber-400">{lateCount}</strong></span>
                  <span>Absent: <strong className="text-rose-400">{absentCount}</strong></span>
                </div>
              </div>
              <Link href="/attendance" className="text-xs text-red-400">Full Attendance Log</Link>
            </div>
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {attendance && attendance.length > 0 ? (
                  attendance.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono text-xs">{a.date}</td>
                      <td>
                        {a.status === "Present" && <span className="badge-success">🟢 Present</span>}
                        {a.status === "Late" && <span className="badge-warning">🟡 Late</span>}
                        {a.status === "Absent" && <span className="badge-danger">🔴 Absent</span>}
                      </td>
                      <td className="font-mono text-xs">{a.check_in || "—"}</td>
                      <td className="font-mono text-xs">{a.check_out || "—"}</td>
                      <td className="text-muted text-xs">{a.method || "HR Manual"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted">No attendance recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Performance Summary Card */}
          <div className="card p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-border/40 pb-2">
              <h2 className="text-sm font-semibold text-white">Performance Overview</h2>
              <Link href="/performance" className="text-xs text-red-400">View Reviews</Link>
            </div>
            {latestReview ? (
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-muted">Period: {latestReview.period}</div>
                  <div className="text-sm font-medium text-text mt-1">{latestReview.summary}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-400 font-mono">{latestReview.overall_score}%</div>
                  <span className="badge-success">🟢 {latestReview.rating}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted text-center py-4">No performance evaluations submitted yet.</div>
            )}
          </div>

          {/* Tasks (If Intern) */}
          {person.person_type === "Intern" && (
            <div className="card p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-border/40 pb-3">
                <h2 className="text-sm font-semibold text-white">Assigned Tasks ({tasks?.length || 0})</h2>
                <Link href="/interns" className="text-xs text-red-400">Task Engine</Link>
              </div>
              <div className="space-y-3">
                {tasks && tasks.length > 0 ? (
                  tasks.map(t => (
                    <div key={t.id} className="p-3 rounded-xl bg-surface-2 border border-border/50 flex justify-between items-center">
                      <div>
                        <div className="font-medium text-text text-xs">{t.title}</div>
                        {t.description && <div className="text-[11px] text-muted italic line-clamp-1">{t.description}</div>}
                        <div className="text-[10px] text-muted font-mono mt-1">Due: {t.due_date}</div>
                      </div>
                      <span className="badge-secondary">{t.status}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted text-xs">No active tasks assigned.</div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
