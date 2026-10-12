import Link from "next/link";
import { ArrowUpRight, LogIn, LogOut } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, SectionHead, Stat, StatusBadge } from "@/components/ui";
import { formatDate, internshipProgress, todayIST } from "@/lib/time";
import { checkIn, checkOut, markAllRead } from "./actions";
import { ActionForm } from "@/components/action-form";

export default async function PortalDashboard() {
  const { person, isAdmin } = await requireViewer();
  const supabase = await createClient();
  const today = todayIST();
  const isIntern = person.person_type === "Intern";

  const [{ data: att }, { data: tasks }, { data: leaves }, { data: notes }, { data: holidays }, { data: mentor }] = await Promise.all([
    supabase.from("attendance").select("*").eq("person_id", person.id).eq("date", today).maybeSingle(),
    supabase.from("intern_tasks").select("id, title, due_date, status, priority").eq("intern_id", person.id).neq("status", "Approved").order("due_date"),
    supabase.from("leave_requests").select("id, leave_type, start_date, end_date, status").eq("person_id", person.id).eq("status", "Pending"),
    supabase.from("notifications").select("*").eq("person_id", person.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("holidays").select("date, name").gte("date", today).order("date").limit(3),
    person.mentor_id
      ? supabase.from("people").select("first_name, last_name").eq("id", person.mentor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const dueToday = tasks?.filter((t) => t.due_date === today) ?? [];
  const overdue = tasks?.filter((t) => t.due_date < today) ?? [];
  const upcoming = tasks?.filter((t) => t.due_date > today).slice(0, 4) ?? [];
  const progress = isIntern ? internshipProgress(person.start_date, person.end_date, today) : null;
  const unread = notes?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow={`${formatDate(today)} · ${isIntern ? "Intern" : "Employee"} portal`}
        title={`Hi, ${person.first_name}.`}
        dim="Here's your day."
      >
        {isAdmin && (
          <Link href="/" className="btn-secondary">
            HR dashboard <ArrowUpRight size={14} />
          </Link>
        )}
      </PageHeader>

      {/* Today */}
      <section className="card flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="label">Today&apos;s attendance</div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <StatusBadge status={att?.status} />
            <span className="font-mono text-sm text-muted">In {att?.check_in?.slice(0, 5) ?? "—"}</span>
            <span className="font-mono text-sm text-muted">Out {att?.check_out?.slice(0, 5) ?? "—"}</span>
            {att?.working_hours != null && <span className="font-mono text-sm text-text">{att.working_hours}h worked</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!att?.check_in ? (
            <ActionForm action={checkIn}>
              <button className="btn-primary"><LogIn size={16} /> Check in</button>
            </ActionForm>
          ) : !att.check_out ? (
            <ActionForm action={checkOut}>
              <button className="btn-secondary"><LogOut size={16} /> Check out</button>
            </ActionForm>
          ) : (
            <span className="status-pill"><span className="live-dot" /> Done for today</span>
          )}
        </div>
      </section>

      <section className="stat-strip">
        <Stat label="Due today" value={dueToday.length} hint={dueToday.length ? dueToday[0].title : "Nothing due"} />
        <Stat label="Overdue" value={overdue.length} hint={overdue.length ? <span className="text-brand-2">Needs attention</span> : "All caught up"} />
        <Stat label="Leave pending" value={leaves?.length ?? 0} hint="Awaiting HR" />
        {progress !== null ? (
          <Stat label="Internship" value={progress} unit="%" hint={`${formatDate(person.start_date)} → ${formatDate(person.end_date)}`} />
        ) : (
          <Stat label="Open tasks" value={tasks?.length ?? 0} hint="Not yet approved" />
        )}
      </section>

      {progress !== null && (
        <div className="space-y-2">
          <div className="h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between font-mono text-[11px] text-faint">
            <span>{person.cohort ?? "Internship"}</span>
            <span>Mentor · {mentor ? `${mentor.first_name} ${mentor.last_name}` : "not assigned"}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <SectionHead index="01" title="Your tasks" href="/portal/tasks" hrefLabel="All tasks" />
          {[...overdue, ...dueToday, ...upcoming].length ? (
            <ul className="border-t border-border">
              {[...overdue, ...dueToday, ...upcoming].map((t) => (
                <li key={t.id} className="border-b border-border">
                  <Link href={`/portal/tasks/${t.id}`} className="group flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-text group-hover:text-brand-2">{t.title}</div>
                      <div className={`font-mono text-[11px] ${t.due_date < today ? "text-brand-2" : "text-faint"}`}>
                        {t.due_date < today ? "Overdue · " : t.due_date === today ? "Due today · " : "Due "}
                        {formatDate(t.due_date)}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-border pt-5 text-[13px] text-muted">No open tasks. Nice.</p>
          )}
        </section>

        <aside className="space-y-12">
          <section className="space-y-5">
            <SectionHead index="02" title="Updates">
              {unread > 0 && (
                <ActionForm action={markAllRead}>
                  <button className="link text-muted">Mark read</button>
                </ActionForm>
              )}
            </SectionHead>
            {notes?.length ? (
              <ul className="border-t border-border">
                {notes.map((n) => (
                  <li key={n.id} className="flex gap-3 border-b border-border py-3.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? "bg-surface-3" : "bg-brand"}`} />
                    <div>
                      <div className="text-[14px] font-medium text-text">{n.title}</div>
                      <div className="text-[13px] text-muted">{n.message}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-border pt-4 text-[13px] text-muted">No updates yet.</p>
            )}
          </section>

          <section className="space-y-5">
            <SectionHead index="03" title="Coming up" />
            <ul className="border-t border-border text-[13px]">
              {holidays?.map((h) => (
                <li key={h.date} className="flex justify-between border-b border-border py-3">
                  <span className="text-text">{h.name}</span>
                  <span className="font-mono text-muted">{formatDate(h.date)}</span>
                </li>
              ))}
              {isIntern && person.end_date && (
                <li className="flex justify-between border-b border-border py-3">
                  <span className="text-text">Internship ends</span>
                  <span className="font-mono text-muted">{formatDate(person.end_date)}</span>
                </li>
              )}
              {!holidays?.length && !(isIntern && person.end_date) && <li className="py-3 text-muted">Nothing scheduled.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
