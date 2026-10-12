import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowUpRight, Check, Paperclip, RotateCcw } from "lucide-react";
import { isMentor, logAction, requireViewer } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { attempt, type ActionResult } from "@/lib/action-result";
import { ActionForm } from "@/components/action-form";
import { createClient } from "@/utils/supabase/server";
import { Avatar, PageHeader, SectionHead, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/time";

async function requireReviewer() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin && !(await isMentor(viewer.person.id))) redirect("/portal");
  return viewer;
}

async function reviewSubmission(_prev: ActionResult, fd: FormData) {
  "use server";
  return attempt(() => reviewSubmissionImpl(fd));
}

async function reviewSubmissionImpl(fd: FormData) {
  "use server";
  const { person: actor } = await requireReviewer();
  const supabase = await createClient();
  const id = fd.get("submission_id") as string;
  const decision = fd.get("decision") as string;
  const feedback = ((fd.get("feedback") as string) ?? "").trim();
  const score = fd.get("score") ? Number(fd.get("score")) : null;
  if (decision !== "Approved" && decision !== "Revision Requested") throw new Error("Invalid decision.");
  if (decision === "Revision Requested" && !feedback) throw new Error("Say what needs changing.");
  if (score !== null && !(score >= 0 && score <= 100)) throw new Error("Score must be 0–100.");

  // RLS: admins, or the mentor of the submitter, can update — anyone else gets 0 rows
  const { data: sub } = await supabase
    .from("task_submissions")
    .update({ review_status: decision, feedback: feedback || null, reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("review_status", "Pending")
    .select("task_id, submitted_by")
    .maybeSingle();
  if (!sub) throw new Error("This submission was already reviewed or isn't yours to review.");

  const { data: task } = await supabase
    .from("intern_tasks")
    .update({
      status: decision,
      feedback: feedback || null,
      ...(decision === "Approved" && score !== null ? { score } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.task_id)
    .select("title")
    .single();

  await notify(
    sub.submitted_by,
    decision === "Approved" ? "Task approved" : "Revision requested",
    `${task?.title ?? "Your task"}${feedback ? ` — ${feedback.slice(0, 120)}` : ""}`,
    "task",
  );
  await logAction(actor.id, decision === "Approved" ? "task.approved" : "task.revision_requested", "task", sub.task_id, { score });
  revalidatePath("/review");
}

export default async function ReviewPage() {
  const { isAdmin } = await requireReviewer();
  const supabase = await createClient();

  const [{ data: pending }, { data: recentRows }] = await Promise.all([
    supabase
      .from("task_submissions")
      .select("*, task:intern_tasks(id, title, due_date, priority), by:people!task_submissions_submitted_by_fkey(first_name, last_name, role)")
      .eq("review_status", "Pending")
      .order("created_at"),
    supabase
      .from("task_submissions")
      .select("id, review_status, reviewed_at, task:intern_tasks(title), by:people!task_submissions_submitted_by_fkey(first_name, last_name)")
      .neq("review_status", "Pending")
      .order("reviewed_at", { ascending: false })
      .limit(10),
  ]);
  // many-to-one embeds come back as single objects
  const recent = recentRows as unknown as
    | { id: string; review_status: string; task: { title: string } | null; by: { first_name: string; last_name: string } | null }[]
    | null;

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow={isAdmin ? "People" : "Mentoring"}
        title="Review work,"
        dim="approve or send back."
        description={isAdmin ? "Every pending submission across all interns." : "Submissions from interns you mentor."}
      >
        <span className="status-pill"><b className="tabular-nums">{pending?.length ?? 0}</b> waiting</span>
      </PageHeader>

      <section className="space-y-5">
        <SectionHead index="01" title="Waiting for review" />
        {pending?.length ? (
          <ul className="border-t border-border">
            {pending.map((s) => (
              <li key={s.id} className="grid grid-cols-1 gap-6 border-b border-border py-8 lg:grid-cols-[1fr_22rem]">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar first={s.by?.first_name} last={s.by?.last_name} />
                    <div>
                      <div className="font-medium text-text">{s.by?.first_name} {s.by?.last_name}</div>
                      <div className="font-mono text-[11px] text-faint">
                        Submitted {new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-medium tracking-tight">{s.task?.title}</div>
                    <div className="font-mono text-[11px] text-faint">Due {formatDate(s.task?.due_date)} · {s.task?.priority}</div>
                  </div>
                  {s.note && <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{s.note}</p>}
                  <div className="flex flex-wrap gap-4">
                    {s.link_url && <a href={s.link_url} target="_blank" rel="noreferrer" className="link">Open link <ArrowUpRight size={14} /></a>}
                    {s.file_path && <Link href={`/files/submission/${s.id}`} className="link"><Paperclip size={14} /> {s.file_name}</Link>}
                  </div>
                </div>
                <ActionForm action={reviewSubmission} className="space-y-3">
                  <input type="hidden" name="submission_id" value={s.id} />
                  <label className="label">Feedback</label>
                  <textarea name="feedback" rows={4} className="input" placeholder="What worked, what to change…" />
                  <div className="flex items-center gap-3">
                    <input type="number" name="score" min="0" max="100" placeholder="Score" className="input w-28 tabular-nums" aria-label="Score out of 100" />
                    <span className="text-[12px] text-muted">/ 100 · on approval</span>
                  </div>
                  <div className="flex gap-2">
                    <button name="decision" value="Approved" className="btn-primary flex-1"><Check size={15} /> Approve</button>
                    <button name="decision" value="Revision Requested" className="btn-secondary flex-1"><RotateCcw size={15} /> Revise</button>
                  </div>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-border pt-5 text-[13px] text-muted">Nothing waiting. All reviewed.</p>
        )}
      </section>

      <section className="space-y-5">
        <SectionHead index="02" title="Recently reviewed" />
        <ul className="border-t border-border">
          {recent?.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 border-b border-border py-3.5 text-[14px]">
              <span className="min-w-0 truncate">
                <span className="text-text">{r.task?.title}</span>
                <span className="text-muted"> · {r.by?.first_name} {r.by?.last_name}</span>
              </span>
              <StatusBadge status={r.review_status} />
            </li>
          ))}
          {!recent?.length && <li className="py-3.5 text-[13px] text-muted">No reviews yet.</li>}
        </ul>
      </section>
    </div>
  );
}
