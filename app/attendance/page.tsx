import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, Empty, PageHeader, SectionHead, Stat, StatusBadge } from "@/components/ui";

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

  const MARKS = [
    { value: "Present", label: "Present", tone: "hover:text-ok" },
    { value: "Late", label: "Late", tone: "hover:text-warn" },
    { value: "Absent", label: "Absent", tone: "hover:text-brand-2" },
    { value: "Work From Home", label: "WFH", tone: "hover:text-info" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="Time"
        title="Attendance,"
        dim="day by day."
        description="Daily check-ins, working hours and who's in, late, away or remote."
      >
        <div className="flex items-center gap-1 rounded-full border border-border px-1.5 py-1 text-sm">
          <button className="btn-ghost h-8 w-8 !p-0" aria-label="Previous month"><ChevronLeft size={16} /></button>
          <span className="px-2 font-medium">October 2026</span>
          <button className="btn-ghost h-8 w-8 !p-0" aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
      </PageHeader>

      <section className="stat-strip">
        <Stat label="Present rate" value={totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : "—"} unit={totalRecords > 0 ? "%" : undefined} hint={totalRecords === 0 ? "No attendance data" : `${presentCount} of ${totalRecords} marked`} />
        <Stat label="Late arrivals" value={lateCount} hint="After 10:00" />
        <Stat label="Absences" value={absentCount} hint="Unplanned" />
        <Stat label="On leave" value={leaveCount} hint="Approved time off" />
      </section>

      <section className="space-y-5">
        <SectionHead index="01" title="Daily log" description={`${today} · all active workforce`} />
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="!pl-5">Person</th>
                <th>Department</th>
                <th>Status</th>
                <th>In</th>
                <th>Out</th>
                <th>Hours</th>
                <th className="!pr-5">Mark</th>
              </tr>
            </thead>
            <tbody>
              {people && people.length > 0 ? (
                people.map((person) => {
                  const record = attendanceMap.get(person.id);
                  return (
                    <tr key={person.id}>
                      <td className="!pl-5">
                        <div className="flex items-center gap-3">
                          <Avatar first={person.first_name} last={person.last_name} />
                          <div>
                            <div className="font-medium text-text">{person.first_name} {person.last_name}</div>
                            <div className="text-[12px] text-muted">{person.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="capitalize text-muted">{person.department}</td>
                      <td><StatusBadge status={record?.status} /></td>
                      <td className="font-mono text-xs">{record?.check_in || "—"}</td>
                      <td className="font-mono text-xs">{record?.check_out || "—"}</td>
                      <td className="font-mono text-xs text-muted">{record?.working_hours ? `${record.working_hours}h` : "—"}</td>
                      <td className="!pr-5">
                        <form action={updateAttendance} className="flex items-center gap-0.5">
                          <input type="hidden" name="person_id" value={person.id} />
                          {MARKS.map((m) => (
                            <button
                              key={m.value}
                              type="submit"
                              name="status"
                              value={m.value}
                              aria-pressed={record?.status === m.value}
                              className={`btn-ghost btn-sm !px-2.5 aria-pressed:bg-white/[0.08] aria-pressed:text-text ${m.tone}`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </form>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <Empty colSpan={7}>No people on record.</Empty>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
