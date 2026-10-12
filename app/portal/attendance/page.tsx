import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, SectionHead, Stat, StatusBadge } from "@/components/ui";
import { WEEKLY_OFF, formatDate, todayIST } from "@/lib/time";
import { addWorkLog, requestCorrection } from "../actions";
import { ActionForm } from "@/components/action-form";

type DayKind = "Present" | "Late" | "Absent" | "Half Day" | "Work From Home" | "On Leave" | "Holiday" | "Weekend" | "Future" | "Unmarked";

const DAY_STYLE: Record<DayKind, string> = {
  Present: "bg-ok",
  Late: "bg-warn",
  "Half Day": "bg-warn",
  Absent: "bg-brand",
  "Work From Home": "bg-info",
  "On Leave": "bg-violet",
  Holiday: "bg-mauve",
  Weekend: "bg-surface-3",
  Future: "bg-transparent",
  Unmarked: "bg-transparent border border-border-strong",
};

export default async function PortalAttendancePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { person } = await requireViewer();
  const supabase = await createClient();
  const today = todayIST();

  const { m } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(y, mo, 0).getDate();
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const prev = new Date(y, mo - 2, 1);
  const next = new Date(y, mo, 1);
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const [{ data: att }, { data: leave }, { data: holidays }, { data: logs }, { data: corrections }] = await Promise.all([
    supabase.from("attendance").select("*").eq("person_id", person.id).gte("date", first).lte("date", last),
    supabase.from("leave_requests").select("start_date, end_date, leave_type").eq("person_id", person.id).eq("status", "Approved").lte("start_date", last).gte("end_date", first),
    supabase.from("holidays").select("date, name").gte("date", first).lte("date", last),
    supabase.from("work_logs").select("*").eq("person_id", person.id).order("date", { ascending: false }).limit(10),
    supabase.from("attendance_corrections").select("*").eq("person_id", person.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const byDate = new Map(att?.map((a) => [a.date, a]));
  const holidayOn = new Map(holidays?.map((h) => [h.date, h.name]));

  // Precedence avoids double counting: a recorded status wins, then approved
  // leave, then holiday, then weekly off. Leave on a holiday counts as holiday.
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const dow = new Date(y, mo - 1, i + 1).getDay();
    const rec = byDate.get(date);
    let kind: DayKind;
    if (rec) kind = rec.status as DayKind;
    else if (holidayOn.has(date)) kind = "Holiday";
    else if (WEEKLY_OFF.has(dow)) kind = "Weekend";
    else if (leave?.some((l) => l.start_date <= date && l.end_date >= date)) kind = "On Leave";
    else if (date > today) kind = "Future";
    else kind = "Unmarked";
    return { date, day: i + 1, dow, kind, rec, holiday: holidayOn.get(date) };
  });

  const count = (k: DayKind[]) => days.filter((d) => k.includes(d.kind)).length;
  const hours = att?.reduce((n, a) => n + Number(a.working_hours || 0), 0) ?? 0;
  const leadBlanks = (new Date(y, mo - 1, 1).getDay() + 6) % 7; // Monday-first grid

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader eyebrow="Work" title="Attendance," dim="your month at a glance.">
        <div className="flex items-center gap-1 rounded-full border border-border px-1.5 py-1 text-sm">
          <Link href={`?m=${ym(prev)}`} className="btn-ghost h-8 w-8 !p-0" aria-label="Previous month"><ChevronLeft size={16} /></Link>
          <span className="px-2 font-medium">{new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}</span>
          <Link href={`?m=${ym(next)}`} className="btn-ghost h-8 w-8 !p-0" aria-label="Next month"><ChevronRight size={16} /></Link>
        </div>
      </PageHeader>

      <section className="stat-strip">
        <Stat label="Present" value={count(["Present", "Late", "Work From Home"])} unit="days" hint={`${count(["Late"])} late`} />
        <Stat label="Absent" value={count(["Absent"])} unit="days" hint={`${count(["Unmarked"])} unmarked`} />
        <Stat label="On leave" value={count(["On Leave"])} unit="days" hint={`${count(["Holiday"])} holidays`} />
        <Stat label="Hours" value={Math.round(hours * 10) / 10} unit="h" hint="From check-in / out" />
      </section>

      {/* Calendar */}
      <section className="space-y-4">
        <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: leadBlanks }, (_, i) => <div key={`b${i}`} />)}
          {days.map((d) => (
            <div
              key={d.date}
              title={`${formatDate(d.date)} · ${d.holiday ?? d.kind}${d.rec?.check_in ? ` · ${d.rec.check_in.slice(0, 5)}–${d.rec.check_out?.slice(0, 5) ?? ""}` : ""}`}
              className={`flex aspect-square flex-col justify-between rounded-xl border p-2 text-left sm:p-2.5 ${d.date === today ? "border-text" : "border-border"} ${d.kind === "Weekend" || d.kind === "Future" ? "opacity-50" : ""}`}
            >
              <span className="font-mono text-[12px] tabular-nums text-muted">{d.day}</span>
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${DAY_STYLE[d.kind]}`} />
                <span className="hidden truncate text-[10px] text-muted md:inline">{d.holiday ?? (d.kind === "Future" || d.kind === "Weekend" ? "" : d.kind === "Work From Home" ? "WFH" : d.kind)}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-[12px] text-muted">
          {(["Present", "Late", "Absent", "Work From Home", "On Leave", "Holiday", "Unmarked"] as DayKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DAY_STYLE[k]}`} /> {k === "Work From Home" ? "WFH" : k}
            </span>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-12 border-t border-border pt-12 lg:grid-cols-2">
        {/* Work log */}
        <section className="space-y-5">
          <SectionHead index="01" title="Work log" description="What you worked on, and for how long." />
          <ActionForm action={addWorkLog} className="grid grid-cols-[1fr_6rem] gap-3">
            <input type="date" name="date" defaultValue={today} max={today} className="input" aria-label="Date" />
            <input type="number" name="hours" step="0.25" min="0.25" max="24" placeholder="Hours" className="input tabular-nums" required />
            <textarea name="summary" rows={2} placeholder="Summary of the work…" className="input col-span-2" required />
            <div className="col-span-2 flex justify-end"><button className="btn-primary btn-sm">Add entry</button></div>
          </ActionForm>
          <ul className="border-t border-border">
            {logs?.map((l) => (
              <li key={l.id} className="grid grid-cols-[6rem_1fr_3rem] gap-3 border-b border-border py-3 text-[13px]">
                <span className="font-mono text-muted">{formatDate(l.date)}</span>
                <span className="text-text">{l.summary}</span>
                <span className="text-right font-mono text-muted">{l.hours}h</span>
              </li>
            ))}
            {!logs?.length && <li className="py-3 text-[13px] text-muted">No entries yet.</li>}
          </ul>
        </section>

        {/* Corrections */}
        <section className="space-y-5">
          <SectionHead index="02" title="Missed a check-in?" description="Ask HR to correct a past day." />
          <ActionForm action={requestCorrection} className="grid grid-cols-3 gap-3">
            <input type="date" name="date" max={today} className="input" aria-label="Date" required />
            <input type="time" name="check_in" className="input" aria-label="Actual check-in" />
            <input type="time" name="check_out" className="input" aria-label="Actual check-out" />
            <input type="text" name="reason" placeholder="What happened?" className="input col-span-3" required />
            <div className="col-span-3 flex justify-end"><button className="btn-secondary btn-sm">Request correction</button></div>
          </ActionForm>
          <ul className="border-t border-border">
            {corrections?.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 border-b border-border py-3 text-[13px]">
                <div>
                  <div className="text-text">{formatDate(c.date)} · {c.requested_check_in?.slice(0, 5) ?? "—"}–{c.requested_check_out?.slice(0, 5) ?? "—"}</div>
                  <div className="text-muted">{c.reason}</div>
                  {c.decision_note && <div className="mt-1 text-muted">HR: {c.decision_note}</div>}
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
            {!corrections?.length && <li className="py-3 text-[13px] text-muted">No correction requests.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
