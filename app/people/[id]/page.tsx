import { createClient } from "@/utils/supabase/server";
import { logAction, requireAdmin } from "@/lib/auth";
import { allowEmail, disallowEmail } from "@/lib/clerk-allowlist";
import { sendOnboardingEmail } from "@/lib/email";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowUpRight, Mail, Phone, Calendar, CheckCircle2, Circle, Edit3, UserX, UserCheck, CheckSquare } from "lucide-react";
import { Avatar, PageHeader, SectionHead, Stat, StatusBadge } from "@/components/ui";

export default async function PersonProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { id } = await params;
  const { email: emailStatus } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const { data: person } = await supabase.from("people").select("*").eq("id", id).single();

  if (!person) {
    notFound();
  }

  // Server Action: Complete Onboarding Workflow
  async function completeOnboardingAction() {
    "use server";
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();

    await supabase.from("people").update({
      status: "Active",
      onboarding_progress: 100
    }).eq("id", id);
    await logAction(actor.id, "onboarding.completed", "person", id);

    revalidatePath(`/people/${id}`);
    revalidatePath("/people");
    revalidatePath("/");
  }

  // Server Action: Controlled Deactivation (Soft Archive)
  async function deactivatePersonAction(formData: FormData) {
    "use server";
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();

    if (actor.id === id) throw new Error("You can't deactivate your own account.");

    const isIntern = person.person_type === "Intern";
    const targetStatus = isIntern ? "Completed" : "Terminated";

    await supabase.from("people").update({
      status: targetStatus
    }).eq("id", id);
    if (!isIntern) await disallowEmail(person.email);
    await logAction(actor.id, isIntern ? "internship.completed" : "person.deactivated", "person", id);

    revalidatePath(`/people/${id}`);
    revalidatePath("/people");
    revalidatePath("/");
    redirect("/people");
  }

  // Server Action: issue a fresh onboarding link and email it
  async function resendOnboardingAction() {
    "use server";
    const { person: actor } = await requireAdmin();
    const admin = createAdminClient();
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");

    // retire any unused links so only the newest one works
    await admin.from("onboarding_tokens").update({ used: true }).eq("person_id", id).eq("used", false);
    const { error } = await admin.from("onboarding_tokens").insert({
      person_id: id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      used: false,
    });
    if (error) redirect(`/people/${id}?email=failed`);

    const sent = await sendOnboardingEmail(person, token);
    await logAction(actor.id, sent.ok ? "email.onboarding_sent" : "email.onboarding_failed", "person", id, sent.ok ? undefined : { error: sent.error });
    revalidatePath(`/people/${id}`);
    redirect(`/people/${id}?email=${sent.ok ? "sent" : "failed"}`);
  }

  // Server Action: Reactivate
  async function reactivatePersonAction() {
    "use server";
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();

    await supabase.from("people").update({
      status: "Active"
    }).eq("id", id);
    await allowEmail(person.email);
    await logAction(actor.id, "person.reactivated", "person", id);

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

  const isIntern = person.person_type === "Intern";
  const STATUS_LABEL: Record<string, string> = { Completed: "Internship completed", Terminated: "Inactive" };
  const details: [string, React.ReactNode][] = [
    ["SOMENTM ID", <span key="id" className="font-mono">{person.employee_id}</span>],
    ["Department", <span key="d" className="capitalize">{person.department}</span>],
    ["Role", person.role],
    ["Type", person.employment_type || person.person_type],
    ["Status", <StatusBadge key="s" status={person.status} />],
    ...(isIntern
      ? ([
          ["Cohort", person.cohort || "—"],
          ["Duration", `${person.start_date || "—"} → ${person.end_date || "—"}`],
        ] as [string, React.ReactNode][])
      : []),
    ...(onboardingSub?.student_id_doc_name
      ? ([["Student ID", <span key="sid" className="font-mono text-[12px] text-ok">{onboardingSub.student_id_doc_name}</span>]] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        back={{ href: "/people", label: "People" }}
        eyebrow={`${person.employment_type || person.person_type} · ${person.employee_id}`}
        title={person.first_name}
        dim={person.last_name}
      >
        <button className="btn-secondary">
          <Edit3 size={15} /> Edit profile
        </button>
        {person.status === "Active" ? (
          <form action={deactivatePersonAction}>
            <button type="submit" className="btn-danger">
              <UserX size={15} /> {isIntern ? "Complete internship" : "Deactivate"}
            </button>
          </form>
        ) : (
          <form action={reactivatePersonAction}>
            <button type="submit" className="btn-secondary">
              <UserCheck size={15} /> Reactivate
            </button>
          </form>
        )}
      </PageHeader>

      {emailStatus === "sent" && (
        <p role="status" className="flex items-center gap-2.5 rounded-2xl border border-ok/30 bg-ok-soft px-4 py-3 text-sm">
          <span className="live-dot" /> Onboarding email sent to <b className="font-medium">{person.email}</b>.
        </p>
      )}
      {emailStatus === "failed" && (
        <p role="alert" className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
          <span className="live-dot danger" /> The onboarding email couldn&apos;t be sent. Check the Audit log for the reason, or copy the portal link below and send it yourself.
        </p>
      )}

      {/* Identity strip */}
      <section className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <Avatar first={person.first_name} last={person.last_name} size="lg" />
          <div className="space-y-2">
            <div className="text-lg font-medium tracking-tight">
              {person.role} <span className="text-muted">· <span className="capitalize">{person.department}</span></span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <StatusBadge status={person.status} label={STATUS_LABEL[person.status]} />
              <span className="font-mono text-[11px] text-faint">Onboarding {onboardingPercentage}%</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-[13px] text-muted">
          <div className="flex items-center gap-2.5"><Mail size={14} className="text-faint" /> {person.email}</div>
          <div className="flex items-center gap-2.5"><Phone size={14} className="text-faint" /> {person.phone || "No phone added"}</div>
          <div className="flex items-center gap-2.5"><Calendar size={14} className="text-faint" /> Joined {person.joined_date || "—"}</div>
        </div>
      </section>

      <section className="stat-strip">
        <Stat label="Present rate" value={attRate} unit={attRate !== "—" ? "%" : undefined} hint={`Last ${totalAtt} records`} />
        <Stat label="Late" value={lateCount} />
        <Stat label="Absent" value={absentCount} />
        <Stat
          label="Latest KPI"
          value={latestReview ? Math.round(latestReview.overall_score) : "—"}
          unit={latestReview ? "/ 100" : undefined}
          hint={latestReview ? latestReview.period : "No reviews yet"}
        />
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-12">
          <section className="space-y-4">
            <SectionHead index="01" title="Employment" />
            <dl className="border-t border-border text-[13px]">
              {details.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-border py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right text-text">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="space-y-4">
            <SectionHead index="02" title="Onboarding">
              <span className="font-mono text-[12px] tabular-nums text-muted">{completedCount}/{onboardingChecklist.length}</span>
            </SectionHead>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-all" style={{ width: `${onboardingPercentage}%` }} />
            </div>
            <ul className="space-y-2.5 pt-1 text-[13px]">
              {onboardingChecklist.map((stage, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3">
                  <span className={`flex items-start gap-2.5 ${stage.done ? "text-text" : "text-muted"}`}>
                    {stage.done ? <CheckCircle2 size={15} className="mt-px shrink-0 text-ok" /> : <Circle size={15} className="mt-px shrink-0 text-faint" />}
                    {stage.label}
                  </span>
                  <span className="index mt-0.5 uppercase">{stage.owner}</span>
                </li>
              ))}
            </ul>

            {person.status !== "Active" && person.status !== "Completed" && person.status !== "Terminated" && (
              <form action={resendOnboardingAction}>
                <button className="btn-secondary btn-sm w-full">
                  <Mail size={14} /> Resend onboarding email
                </button>
              </form>
            )}
            {activeToken ? (
              <div className="card-2 space-y-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="label !mb-0">Candidate portal link</span>
                  {onboardingTok?.used && <span className="badge-ok">Submitted</span>}
                </div>
                <div className="flex items-center gap-3">
                  <input readOnly value={`/onboarding/${activeToken}`} className="input py-1.5 font-mono text-[11px] text-muted" />
                  <Link href={`/onboarding/${activeToken}`} target="_blank" className="link shrink-0">
                    Open <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            ) : null}

            {person.status === "Onboarding" && (
              <div className="space-y-2 pt-2">
                <form action={completeOnboardingAction}>
                  <button type="submit" disabled={!isReadyToComplete} className="btn-primary w-full">
                    <CheckSquare size={15} /> Complete onboarding & activate
                  </button>
                </form>
                {!isReadyToComplete && (
                  <p className="text-center text-[12px] text-muted">The candidate needs to finish the portal submission first.</p>
                )}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHead index="03" title="Leave balance" href="/leave" hrefLabel="All leave" />
            <div className="grid grid-cols-3 border-y border-border">
              {[
                ["Casual", 8, 12],
                ["Sick", 6, 10],
                ["Earned", 12, 18],
              ].map(([label, used, total], i) => (
                <div key={label} className={`py-4 ${i ? "border-l border-border pl-4" : ""}`}>
                  <div className="label">{label}</div>
                  <div className="display text-2xl tabular-nums">
                    {used}<span className="stat-unit">/ {total}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-12 lg:col-span-2">
          <section className="space-y-5">
            <SectionHead index="04" title="Attendance" description="Most recent ten days" href="/attendance" hrefLabel="Full log" />
            <div className="card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="!pl-5">Date</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                    <th className="!pr-5">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance && attendance.length > 0 ? (
                    attendance.map(a => (
                      <tr key={a.id}>
                        <td className="!pl-5 font-mono text-xs">{a.date}</td>
                        <td><StatusBadge status={a.status} /></td>
                        <td className="font-mono text-xs">{a.check_in || "—"}</td>
                        <td className="font-mono text-xs">{a.check_out || "—"}</td>
                        <td className="!pr-5 text-muted">{a.method || "HR Manual"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="!border-b-0 py-10 text-center text-[13px] text-muted">No attendance recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-5">
            <SectionHead index="05" title="Performance" href="/performance" hrefLabel="All reviews" />
            {latestReview ? (
              <div className="grid grid-cols-1 gap-4 border-y border-border py-6 md:grid-cols-[10rem_1fr] md:gap-8">
                <div>
                  <div className="display text-5xl tabular-nums">
                    {Math.round(latestReview.overall_score)}<span className="stat-unit">/ 100</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-faint">{latestReview.period}</div>
                </div>
                <div className="space-y-3">
                  <StatusBadge status={latestReview.rating} />
                  <p className="text-[14px] leading-relaxed text-muted">{latestReview.summary}</p>
                </div>
              </div>
            ) : (
              <p className="border-t border-border pt-5 text-[13px] text-muted">No performance reviews yet.</p>
            )}
          </section>

          {isIntern && (
            <section className="space-y-5">
              <SectionHead index="06" title="Assigned tasks" description={`${tasks?.length || 0} tasks`} href="/interns" hrefLabel="Task engine" />
              {tasks && tasks.length > 0 ? (
                <ul className="border-t border-border">
                  {tasks.map((t, i) => (
                    <li key={t.id} className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-4 border-b border-border py-4">
                      <span className="index">{String(i + 1).padStart(2, "0")}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-text">{t.title}</div>
                        {t.description && <div className="line-clamp-1 text-[13px] text-muted">{t.description}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={t.status} />
                        <span className="font-mono text-[11px] text-faint">Due {t.due_date}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t border-border pt-5 text-[13px] text-muted">No tasks assigned.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
