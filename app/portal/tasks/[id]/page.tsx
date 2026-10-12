import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Paperclip, Send } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, SectionHead, StatusBadge } from "@/components/ui";
import { formatDate, todayIST } from "@/lib/time";
import { startTask, submitTask } from "../../actions";
import { ActionForm } from "@/components/action-form";

export default async function PortalTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { person } = await requireViewer();
  const supabase = await createClient();

  const { data: task } = await supabase.from("intern_tasks").select("*").eq("id", id).maybeSingle();
  if (!task || task.intern_id !== person.id) notFound();

  const { data: subs } = await supabase
    .from("task_submissions")
    .select("*, reviewer:people!task_submissions_reviewed_by_fkey(first_name, last_name)")
    .eq("task_id", id)
    .order("created_at", { ascending: false });

  const overdue = task.status !== "Approved" && task.due_date < todayIST();
  const canSubmit = task.status !== "Approved" && task.status !== "Submitted";

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader back={{ href: "/portal/tasks", label: "Tasks" }} eyebrow="Task" title={task.title}>
        <StatusBadge status={task.status} />
      </PageHeader>

      <section className="stat-strip">
        {[
          ["Due", <span key="d" className={overdue ? "text-brand-2" : ""}>{formatDate(task.due_date)}{overdue ? " · overdue" : ""}</span>],
          ["Priority", <StatusBadge key="p" status={task.priority} />],
          ["Estimated", task.estimated_hours ? `${task.estimated_hours}h` : "—"],
          ["Assigned", formatDate(task.created_at)],
        ].map(([k, v]) => (
          <div key={k as string} className="!py-5">
            <div className="label">{k}</div>
            <div className="text-[15px]">{v}</div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <SectionHead index="01" title="Brief" />
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted">{task.description || "No description."}</p>
        {task.resource_url && (
          <a href={task.resource_url} target="_blank" rel="noreferrer" className="link">
            Resources <ArrowUpRight size={14} />
          </a>
        )}
        {task.status === "Assigned" && (
          <ActionForm action={startTask}>
            <input type="hidden" name="task_id" value={task.id} />
            <button className="btn-secondary btn-sm">Mark as started</button>
          </ActionForm>
        )}
      </section>

      {canSubmit && (
        <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
          <div className="space-y-3">
            <SectionHead index="02" title={task.status === "Revision Requested" ? "Resubmit" : "Submit work"} />
            <p className="max-w-xs text-[13px] leading-relaxed text-muted">Add a note, a link (Drive, GitHub, Figma…) or a file up to 4 MB. Your mentor is notified.</p>
          </div>
          <ActionForm action={submitTask} className="space-y-5 lg:col-span-2">
            <input type="hidden" name="task_id" value={task.id} />
            <div>
              <label className="label">Note</label>
              <textarea name="note" rows={4} className="input" placeholder="What you did, anything the reviewer should know…" />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="label">Link</label>
                <input type="url" name="link_url" className="input" placeholder="https://…" />
              </div>
              <div>
                <label className="label">File</label>
                <input type="file" name="file" className="input text-xs file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black" />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="btn-primary"><Send size={15} /> Submit for review</button>
            </div>
          </ActionForm>
        </section>
      )}

      <section className="space-y-5 border-t border-border pt-12">
        <SectionHead index={canSubmit ? "03" : "02"} title="History" description={`${subs?.length ?? 0} submission${subs?.length === 1 ? "" : "s"}`} />
        {subs?.length ? (
          <ol className="border-t border-border">
            {subs.map((s) => (
              <li key={s.id} className="space-y-3 border-b border-border py-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-[12px] text-muted">
                    Submitted {new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                  </span>
                  <StatusBadge status={s.review_status === "Pending" ? "Submitted" : s.review_status} label={s.review_status === "Pending" ? "Awaiting review" : undefined} />
                </div>
                {s.note && <p className="whitespace-pre-wrap text-[14px] text-text">{s.note}</p>}
                <div className="flex flex-wrap gap-4">
                  {s.link_url && <a href={s.link_url} target="_blank" rel="noreferrer" className="link">Link <ArrowUpRight size={14} /></a>}
                  {s.file_path && <Link href={`/files/submission/${s.id}`} className="link"><Paperclip size={14} /> {s.file_name}</Link>}
                </div>
                {s.feedback && (
                  <div className="card-2 p-4">
                    <div className="label">Feedback{s.reviewer ? ` · ${s.reviewer.first_name} ${s.reviewer.last_name}` : ""}</div>
                    <p className="whitespace-pre-wrap text-[14px] text-text">{s.feedback}</p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-t border-border pt-4 text-[13px] text-muted">Nothing submitted yet.</p>
        )}
      </section>
    </div>
  );
}
