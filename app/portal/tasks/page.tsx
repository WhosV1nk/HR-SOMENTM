import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, todayIST } from "@/lib/time";

const GROUPS = [
  { title: "To do", match: ["Assigned", "In Progress", "Revision Requested"] },
  { title: "In review", match: ["Submitted"] },
  { title: "Done", match: ["Approved"] },
];

export default async function PortalTasksPage() {
  const { person } = await requireViewer();
  const supabase = await createClient();
  const today = todayIST();

  const { data: tasks } = await supabase
    .from("intern_tasks")
    .select("id, title, due_date, status, priority, estimated_hours")
    .eq("intern_id", person.id)
    .order("due_date");

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader eyebrow="Work" title="Tasks," dim="from brief to approved." description="Open a task to see the brief, submit your work and read feedback." />

      {GROUPS.map((g, gi) => {
        const rows = tasks?.filter((t) => g.match.includes(t.status ?? "Assigned")) ?? [];
        return (
          <section key={g.title} className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="index">{String(gi + 1).padStart(2, "0")}</span>
              <h2 className="text-xl font-medium tracking-tight">{g.title}</h2>
              <span className="font-mono text-[12px] text-faint">{rows.length}</span>
            </div>
            {rows.length ? (
              <ul className="border-t border-border">
                {rows.map((t) => (
                  <li key={t.id} className="border-b border-border">
                    <Link href={`/portal/tasks/${t.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-4 md:grid-cols-[1fr_9rem_7rem_8rem]">
                      <span className="truncate font-medium text-text group-hover:text-brand-2">{t.title}</span>
                      <span className={`hidden font-mono text-[12px] md:block ${t.status !== "Approved" && t.due_date < today ? "text-brand-2" : "text-muted"}`}>
                        {formatDate(t.due_date)}
                      </span>
                      <span className="hidden md:block"><StatusBadge status={t.priority} /></span>
                      <span className="justify-self-end"><StatusBadge status={t.status} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-border pt-4 text-[13px] text-muted">Nothing here.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
