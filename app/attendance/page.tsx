import { createClient } from "@/utils/supabase/server";
import { logAction, requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Check, X } from "lucide-react";
import { notify } from "@/lib/notify";
import { formatDate, todayIST } from "@/lib/time";
import { Avatar, Empty, PageHeader, SectionHead, Stat, StatusBadge } from "@/components/ui";

export default async function AttendancePage() {
  await requireAdmin();
  const supabase = await createClient();

  const today = todayIST();

  const { data: people } = await supabase.from("people").select("*").order("first_name");
  const { data: attendance } = await supabase.from("attendance").select("*").eq("date", today);
  const { data: corrections } = await supabase
    .from("attendance_corrections")
    .select("*, people!attendance_corrections_person_id_fkey(first_name, last_name, role)")
    .eq("status", "Pending")
    .order("date");

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
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();

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

    await logAction(actor.id, "attendance.marked", "person", person_id, { status });
    revalidatePath("/attendance");
  }

  async function decideCorrection(formData: FormData) {
    "use server";
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();
    const id = formData.get("id") as string;
    const decision = formData.get("decision") as string;
    const note = ((formData.get("note") as string) ?? "").trim() || null;
    if (decision !== "Approved" && decision !== "Rejected") throw new Error("Invalid decision.");

    const { data: c } = await supabase
      .from("attendance_corrections")
      .update({ status: decision, decided_by: actor.id, decided_at: new Date().toISOString(), decision_note: note })
      .eq("id", id)
      .eq("status", "Pending")
      .select("*")
      .maybeSingle();
    if (!c) throw new Error("Already decided.");

    if (decision === "Approved") {
      const inT = c.requested_check_in as string | null;
      const outT = c.requested_check_out as string | null;
      const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      const { data: existing } = await supabase.from("attendance").select("check_in, check_out").eq("person_id", c.person_id).eq("date", c.date).maybeSingle();
      const check_in = inT ?? existing?.check_in ?? null;
      const check_out = outT ?? existing?.check_out ?? null;
      await supabase.from("attendance").upsert({
        person_id: c.person_id,
        date: c.date,
        check_in,
        check_out,
        working_hours: check_in && check_out ? Math.round(((mins(check_out) - mins(check_in)) / 60) * 100) / 100 : null,
        status: check_in && mins(check_in) > 600 ? "Late" : "Present",
        method: "Correction",
        notes: c.reason,
      }, { onConflict: "person_id,date" });
    }
    await notify(c.person_id, `Attendance correction ${decision.toLowerCase()}`, `${formatDate(c.date)}${note ? ` — ${note}` : ""}`, "attendance");
    await logAction(actor.id, `attendance.correction_${decision.toLowerCase()}`, "person", c.person_id, { date: c.date });
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
        <span className="status-pill"><span className="live-dot" /> <b>{formatDate(today)}</b> · IST</span>
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

      {corrections && corrections.length > 0 && (
        <section className="space-y-5">
          <SectionHead index="02" title="Correction requests" description={`${corrections.length} waiting`} />
          <ul className="border-t border-border">
            {corrections.map((c) => (
              <li key={c.id} className="grid grid-cols-1 gap-4 border-b border-border py-5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex items-start gap-3">
                  <Avatar first={c.people?.first_name} last={c.people?.last_name} />
                  <div>
                    <div className="font-medium text-text">{c.people?.first_name} {c.people?.last_name} · {formatDate(c.date)}</div>
                    <div className="font-mono text-[12px] text-muted">
                      In {c.requested_check_in?.slice(0, 5) ?? "—"} · Out {c.requested_check_out?.slice(0, 5) ?? "—"}
                    </div>
                    <div className="text-[13px] text-muted">{c.reason}</div>
                  </div>
                </div>
                <form action={decideCorrection} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="note" placeholder="Note (optional)" className="input w-48 rounded-full py-1.5 text-[13px]" />
                  <button name="decision" value="Approved" className="btn-primary btn-sm"><Check size={14} /> Approve</button>
                  <button name="decision" value="Rejected" className="btn-ghost btn-sm hover:!text-brand-2"><X size={14} /> Reject</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
