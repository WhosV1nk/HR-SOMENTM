import { Users, UserCheck, Calendar, Clock, ArrowUpRight, CheckCircle2, AlertCircle, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const today = new Date().toISOString().split("T")[0];

  // Single Source of Truth Queries from database
  const [
    { count: totalPeople },
    { count: totalEmployees },
    { count: totalInterns },
    { data: attendanceToday },
    { data: peopleList },
    { data: pendingLeaves },
    { data: activeInterns }
  ] = await Promise.all([
    supabase.from("people").select("*", { count: "exact", head: true }),
    supabase.from("people").select("*", { count: "exact", head: true }).eq("person_type", "Employee"),
    supabase.from("people").select("*", { count: "exact", head: true }).eq("person_type", "Intern").eq("status", "Active"),
    supabase.from("attendance").select("*, people(first_name, last_name, department, role)").eq("date", today),
    supabase.from("people").select("*").order("first_name"),
    supabase.from("leave_requests").select("*, people(first_name, last_name)").eq("status", "Pending"),
    supabase.from("people").select("*").eq("person_type", "Intern").eq("status", "Active")
  ]);

  const presentCount = attendanceToday?.filter(a => a.status === "Present" || a.status === "Late").length || 0;
  const lateCount = attendanceToday?.filter(a => a.status === "Late").length || 0;
  const absentCount = attendanceToday?.filter(a => a.status === "Absent").length || 0;

  // Server action for Check-in / Check-out session management
  async function toggleCheckIn(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const person_id = formData.get("person_id") as string;
    const action_type = formData.get("action_type") as string;
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0].substring(0, 5);

    if (action_type === "check_in") {
      const isLate = now.getHours() >= 10;
      await supabase.from("attendance").upsert({
        person_id,
        date: today,
        check_in: timeStr,
        status: isLate ? "Late" : "Present",
        method: "Self Check-in",
      }, { onConflict: "person_id,date" });
    } else {
      await supabase.from("attendance").update({
        check_out: timeStr,
      }).eq("person_id", person_id).eq("date", today);
    }

    revalidatePath("/");
  }

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="page-title text-white">HR Command Center</h1>
          <p className="mt-1 text-sm text-muted">Real-time status of SOMENTM workforce, check-ins, and pending actions.</p>
        </div>
        
        {/* Smart Check-in / Check-out Widget */}
        <div className="card p-3 flex items-center gap-3 bg-surface-2/80">
          <Clock size={18} className="text-red-400 ml-1" />
          <div className="text-xs">
            <div className="font-medium text-text">Session Check-in</div>
            <div className="text-muted text-[11px]">{today}</div>
          </div>
          <form action={toggleCheckIn} className="flex items-center gap-2">
            <select name="person_id" className="bg-surface-3 text-xs rounded-lg px-2 py-1.5 border border-border text-white focus:outline-none" required>
              <option value="">Select Person</option>
              {peopleList?.map(p => {
                const record = attendanceToday?.find(a => a.person_id === p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} {record?.check_in ? (record.check_out ? "(Checked Out)" : "(Checked In)") : ""}
                  </option>
                );
              })}
            </select>

            <button type="submit" name="action_type" value="check_in" className="btn-primary text-xs py-1.5 px-3">
              Check In
            </button>
            <button type="submit" name="action_type" value="check_out" className="btn-secondary text-xs py-1.5 px-3">
              Check Out
            </button>
          </form>
        </div>
      </div>

      {/* Overview Cards (Pure Single Source of Truth Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card p-5 border-l-4 border-l-red-500 bg-surface/50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Total People</span>
            <Users size={18} className="text-red-400" />
          </div>
          <div className="text-3xl font-bold text-white">{totalPeople || 0}</div>
          <div className="text-[11px] text-muted mt-1">Across all departments</div>
        </div>

        <div className="card p-5 border-l-4 border-l-blue-500 bg-surface/50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Employees</span>
            <Users size={18} className="text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white">{totalEmployees || 0}</div>
          <div className="text-[11px] text-muted mt-1">Full-time, Part-time & Founders</div>
        </div>

        <div className="card p-5 border-l-4 border-l-purple-500 bg-surface/50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Active Interns</span>
            <UserCheck size={18} className="text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">{totalInterns || 0}</div>
          <div className="text-[11px] text-muted mt-1">Active program participants</div>
        </div>

        <div className="card p-5 border-l-4 border-l-emerald-500 bg-surface/50">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Today's Attendance</span>
            <CheckCircle2 size={18} className="text-emerald-400" />
          </div>
          {totalPeople && totalPeople > 0 ? (
            <>
              <div className="text-3xl font-bold text-white">
                {presentCount} <span className="text-sm font-normal text-muted">/ {totalPeople}</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-1">
                {Math.round((presentCount / totalPeople) * 100)}% attendance rate • {lateCount} late · {absentCount} absent
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-semibold text-muted mt-1">—</div>
              <div className="text-[11px] text-muted mt-1">No active workforce</div>
            </>
          )}
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Today's Workforce Attendance Table */}
        <div className="card lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border/50 flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-text">Today's Workforce Attendance</h2>
              <p className="text-xs text-muted">Real-time check-in log for {today}</p>
            </div>
            <Link href="/attendance" className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1">
              Full Log <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                </tr>
              </thead>
              <tbody>
                {attendanceToday && attendanceToday.length > 0 ? (
                  attendanceToday.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div className="font-semibold text-text">
                          {record.people?.first_name} {record.people?.last_name}
                        </div>
                        <div className="text-[11px] text-muted">{record.people?.role}</div>
                      </td>
                      <td className="text-muted">{record.people?.department}</td>
                      <td>
                        {record.status === "Present" && <span className="badge-success">🟢 Present</span>}
                        {record.status === "Late" && <span className="badge-warning">🟡 Late</span>}
                        {record.status === "Absent" && <span className="badge-danger">🔴 Absent</span>}
                        {record.status === "On Leave" && <span className="badge-secondary">🔵 On Leave</span>}
                      </td>
                      <td className="font-mono text-xs text-muted">
                        {record.check_in || "—"}
                      </td>
                      <td className="font-mono text-xs text-muted">
                        {record.check_out || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted">
                      No check-in activity recorded yet today. Add a person to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Pending Actions & Upcoming */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-base font-semibold text-text mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-400" /> Pending Actions
            </h2>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-surface-2 border border-border/50 flex justify-between items-center">
                <div>
                  <div className="font-medium text-text">Leave Requests</div>
                  <div className="text-xs text-muted">{pendingLeaves?.length || 0} pending approval</div>
                </div>
                <Link href="/leave" className="btn-ghost text-xs py-1 px-2.5">Review</Link>
              </div>

              <div className="p-3 rounded-xl bg-surface-2 border border-border/50 flex justify-between items-center">
                <div>
                  <div className="font-medium text-text">Intern Program</div>
                  <div className="text-xs text-muted">{totalInterns || 0} active intern{totalInterns !== 1 ? 's' : ''}</div>
                </div>
                <Link href="/interns" className="btn-ghost text-xs py-1 px-2.5">Manage</Link>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-base font-semibold text-text mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-blue-400" /> Upcoming Milestones
            </h2>
            <div className="space-y-3 text-xs">
              {activeInterns && activeInterns.length > 0 ? (
                activeInterns.map(intern => (
                  <div key={intern.id} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex flex-col items-center justify-center font-bold text-blue-400 text-[10px]">
                      <span>{intern.end_date?.split("-")[2] || "16"}</span>
                    </div>
                    <div>
                      <div className="font-medium text-text">{intern.cohort || "Internship"} Ending</div>
                      <div className="text-muted">{intern.first_name} {intern.last_name} ({intern.department})</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted py-2">No upcoming intern program milestones.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
