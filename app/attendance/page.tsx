import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { CheckCircle2, Clock, XCircle, Home, Calendar, Filter, ChevronLeft, ChevronRight } from "lucide-react";

export default async function AttendancePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const today = new Date().toISOString().split("T")[0];

  const { data: people } = await supabase.from("people").select("*").order("first_name");
  const { data: attendance } = await supabase.from("attendance").select("*").eq("date", today);

  const attendanceMap = new Map();
  attendance?.forEach((record) => {
    attendanceMap.set(record.person_id, record);
  });

  // Calculate monthly stats
  const totalRecords = attendance?.length || 0;
  const presentCount = attendance?.filter(a => a.status === "Present").length || 0;
  const lateCount = attendance?.filter(a => a.status === "Late").length || 0;
  const absentCount = attendance?.filter(a => a.status === "Absent").length || 0;
  const leaveCount = attendance?.filter(a => a.status === "On Leave").length || 0;

  async function updateAttendance(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const person_id = formData.get("person_id") as string;
    const status = formData.get("status") as string;
    const check_in = formData.get("check_in") as string || "09:00";
    const check_out = formData.get("check_out") as string || "18:00";

    await supabase.from("attendance").upsert({
      person_id,
      date: today,
      status,
      check_in,
      check_out,
      method: "HR Manual",
    }, { onConflict: "person_id,date" });

    revalidatePath("/attendance");
  }

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="page-title text-white">Attendance Tracking</h1>
          <p className="mt-1 text-sm text-muted">Daily check-in logs, working hours, and monthly attendance analytics.</p>
        </div>
        
        {/* Month Picker */}
        <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3 py-1.5 text-xs text-white">
          <button className="hover:text-red-400"><ChevronLeft size={16} /></button>
          <span className="font-semibold px-2">October 2026</span>
          <button className="hover:text-red-400"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="card p-4 flex justify-between items-center bg-surface/50 border-l-4 border-l-emerald-500">
          <div>
            <div className="text-xs text-muted font-medium">Present Rate</div>
            <div className="text-2xl font-bold text-white mt-1">
              {totalRecords > 0 ? `${Math.round((presentCount / totalRecords) * 100)}%` : "—"}
            </div>
            {totalRecords === 0 && <div className="text-[10px] text-muted">No attendance data</div>}
          </div>
          <CheckCircle2 size={24} className="text-emerald-400" />
        </div>

        <div className="card p-4 flex justify-between items-center bg-surface/50 border-l-4 border-l-amber-500">
          <div>
            <div className="text-xs text-muted font-medium">Late Arrivals</div>
            <div className="text-2xl font-bold text-white mt-1">{lateCount}</div>
          </div>
          <Clock size={24} className="text-amber-400" />
        </div>

        <div className="card p-4 flex justify-between items-center bg-surface/50 border-l-4 border-l-rose-500">
          <div>
            <div className="text-xs text-muted font-medium">Absences</div>
            <div className="text-2xl font-bold text-white mt-1">{absentCount}</div>
          </div>
          <XCircle size={24} className="text-rose-400" />
        </div>

        <div className="card p-4 flex justify-between items-center bg-surface/50 border-l-4 border-l-blue-500">
          <div>
            <div className="text-xs text-muted font-medium">On Leave</div>
            <div className="text-2xl font-bold text-white mt-1">{leaveCount}</div>
          </div>
          <Calendar size={24} className="text-blue-400" />
        </div>
      </div>

      {/* Attendance Grid */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border/60 flex justify-between items-center bg-surface-2/40">
          <h2 className="text-sm font-semibold text-white">Daily Log ({today})</h2>
          <div className="text-xs text-muted">Showing all active workforce</div>
        </div>

        <table className="table w-full">
          <thead>
            <tr>
              <th>Person</th>
              <th>Department</th>
              <th>Status Today</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Hours</th>
              <th>Quick Mark</th>
            </tr>
          </thead>
          <tbody>
            {people && people.length > 0 ? (
              people.map((person) => {
                const record = attendanceMap.get(person.id);
                const currentStatus = record?.status || "Not Marked";

                return (
                  <tr key={person.id} className="hover:bg-white/[0.02] transition-colors">
                    <td>
                      <div className="font-semibold text-text">{person.first_name} {person.last_name}</div>
                      <div className="text-[11px] text-muted">{person.employee_id} • {person.role}</div>
                    </td>
                    <td className="text-muted text-xs capitalize">{person.department}</td>
                    <td>
                      {currentStatus === "Present" && <span className="badge-success">🟢 Present</span>}
                      {currentStatus === "Late" && <span className="badge-warning">🟡 Late</span>}
                      {currentStatus === "Absent" && <span className="badge-danger">🔴 Absent</span>}
                      {currentStatus === "Half Day" && <span className="badge-warning">🟠 Half Day</span>}
                      {currentStatus === "On Leave" && <span className="badge-secondary">🔵 On Leave</span>}
                      {currentStatus === "Work From Home" && <span className="badge-secondary">🏠 WFH</span>}
                      {currentStatus === "Not Marked" && <span className="badge-secondary">Not Marked</span>}
                    </td>
                    <td className="font-mono text-xs">{record?.check_in || "—"}</td>
                    <td className="font-mono text-xs">{record?.check_out || "—"}</td>
                    <td className="font-mono text-xs text-muted">{record?.working_hours ? `${record.working_hours}h` : "—"}</td>
                    <td>
                      <form action={updateAttendance} className="flex items-center gap-1.5">
                        <input type="hidden" name="person_id" value={person.id} />
                        <button type="submit" name="status" value="Present" className="btn-ghost text-[11px] py-1 px-2 text-emerald-400 hover:bg-emerald-500/10">Present</button>
                        <button type="submit" name="status" value="Late" className="btn-ghost text-[11px] py-1 px-2 text-amber-400 hover:bg-amber-500/10">Late</button>
                        <button type="submit" name="status" value="Absent" className="btn-ghost text-[11px] py-1 px-2 text-rose-400 hover:bg-rose-500/10">Absent</button>
                        <button type="submit" name="status" value="Work From Home" className="btn-ghost text-[11px] py-1 px-2 text-blue-400 hover:bg-blue-500/10">WFH</button>
                      </form>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted">No people records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
