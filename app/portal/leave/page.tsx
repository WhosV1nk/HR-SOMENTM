import { CalendarDays, Send } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, SectionHead, StatusBadge } from "@/components/ui";
import { LEAVE_TYPES, leaveBalances } from "@/lib/leave";
import { formatDate, todayIST } from "@/lib/time";
import { applyLeave, raiseHrRequest } from "../actions";
import { ActionForm } from "@/components/action-form";

const HR_CATEGORIES = ["Documents & letters", "Payroll / stipend", "IT & access", "Policy question", "Other"];

export default async function PortalLeavePage() {
  const { person } = await requireViewer();
  const supabase = await createClient();
  const today = todayIST();

  const [{ data: leaves }, { data: requests }, { data: holidays }] = await Promise.all([
    supabase.from("leave_requests").select("*").eq("person_id", person.id).order("start_date", { ascending: false }),
    supabase.from("hr_requests").select("*").eq("person_id", person.id).order("created_at", { ascending: false }),
    supabase.from("holidays").select("date, name").gte("date", today).order("date").limit(8),
  ]);

  const balances = leaveBalances(person.person_type, leaves ?? []);

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader eyebrow="Work" title="Leave & requests," dim="tracked to a decision." description="Apply for time off, check your balance, and ask HR for anything else." />

      {/* Balances */}
      <section className="space-y-4">
        <SectionHead index="01" title={`Balance · ${new Date().getFullYear()}`} />
        <div className="stat-strip">
          {balances.map((b) => (
            <div key={b.type}>
              <div className="label mb-3">{b.type}</div>
              <div className="stat-value">
                {b.left}
                <span className="stat-unit">/ {b.total} left</span>
              </div>
              <div className="mt-2 text-[12px] text-muted">{b.used} used</div>
            </div>
          ))}
          <div>
            <div className="label mb-3">Unpaid</div>
            <div className="stat-value">∞</div>
            <div className="mt-2 text-[12px] text-muted">Subject to approval</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <SectionHead index="02" title="Apply for leave" />
          <ActionForm action={applyLeave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="label">Type</label>
                <select name="leave_type" className="input" required>
                  {LEAVE_TYPES.filter((t) => t === "Unpaid" || balances.some((b) => b.type === t)).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">From</label>
                <input type="date" name="start_date" min={today} className="input" required />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" name="end_date" min={today} className="input" required />
              </div>
            </div>
            <div>
              <label className="label">Reason</label>
              <input type="text" name="reason" className="input" placeholder="e.g. Family function" required />
            </div>
            <div className="flex justify-end">
              <button className="btn-primary"><CalendarDays size={15} /> Submit request</button>
            </div>
          </ActionForm>

          <ul className="border-t border-border">
            {leaves?.map((l) => (
              <li key={l.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-border py-4">
                <div className="font-medium text-text">
                  {l.leave_type} · {l.duration_days} day{l.duration_days > 1 ? "s" : ""}
                </div>
                <div className="row-span-2 self-center"><StatusBadge status={l.status} /></div>
                <div className="font-mono text-[12px] text-muted">
                  {formatDate(l.start_date)} → {formatDate(l.end_date)}
                  {l.reason ? <span className="font-sans"> · {l.reason}</span> : null}
                  {l.decision_note ? <span className="font-sans"> · HR: {l.decision_note}</span> : null}
                </div>
              </li>
            ))}
            {!leaves?.length && <li className="py-4 text-[13px] text-muted">No leave requested yet.</li>}
          </ul>
        </section>

        <aside className="space-y-5">
          <SectionHead index="03" title="Holidays" />
          <ul className="border-t border-border text-[13px]">
            {holidays?.map((h) => (
              <li key={h.date} className="flex justify-between border-b border-border py-3">
                <span className="text-text">{h.name}</span>
                <span className="font-mono text-muted">{formatDate(h.date)}</span>
              </li>
            ))}
            {!holidays?.length && <li className="py-3 text-muted">None announced yet.</li>}
          </ul>
          <p className="text-[12px] text-muted">Saturdays and Sundays are weekly offs.</p>
        </aside>
      </div>

      {/* HR requests */}
      <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
        <div className="space-y-3">
          <SectionHead index="04" title="Ask HR" />
          <p className="max-w-xs text-[13px] leading-relaxed text-muted">Letters, stipend questions, access problems — anything that isn&apos;t leave. You&apos;ll see HR&apos;s reply here.</p>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <ActionForm action={raiseHrRequest} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[14rem_1fr]">
              <select name="category" className="input" required aria-label="Category">
                {HR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="text" name="subject" className="input" placeholder="Subject" required />
            </div>
            <textarea name="details" rows={3} className="input" placeholder="Details (optional)" />
            <div className="flex justify-end"><button className="btn-secondary"><Send size={15} /> Send to HR</button></div>
          </ActionForm>
          <ul className="border-t border-border">
            {requests?.map((r) => (
              <li key={r.id} className="space-y-1 border-b border-border py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-text">{r.subject}</span>
                  <StatusBadge status={r.status === "Open" ? "Pending" : r.status === "Resolved" ? "Approved" : "Rejected"} label={r.status} />
                </div>
                <div className="font-mono text-[11px] text-faint">{r.category} · {formatDate(r.created_at)}</div>
                {r.response && <p className="pt-1 text-[13px] text-muted">HR: {r.response}</p>}
              </li>
            ))}
            {!requests?.length && <li className="py-4 text-[13px] text-muted">No requests yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
