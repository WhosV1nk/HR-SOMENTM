import { createClient } from "@/utils/supabase/server";
import { logAction, requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { GraduationCap, Award, Link2, FileText, ArrowRight } from "lucide-react";
import { Avatar, Empty, PageHeader, SectionHead, StatusBadge } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { formatDate } from "@/lib/time";

export default async function InternsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: interns } = await supabase.from("people").select("*").eq("person_type", "Intern").order("first_name");
  const { data: mentors } = await supabase.from("people").select("*").eq("person_type", "Employee");
  const { data: tasks } = await supabase.from("intern_tasks").select("*, people:intern_id(first_name, last_name)");

  async function assignMentor(formData: FormData) {
    "use server";
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();

    const intern_id = formData.get("intern_id") as string;
    const mentor_id = formData.get("mentor_id") as string;

    await supabase.from("people").update({ mentor_id: mentor_id || null }).eq("id", intern_id);
    await logAction(actor.id, "mentor.assigned", "person", intern_id, { mentor_id: mentor_id || null });
    revalidatePath("/interns");
  }

  async function createTask(formData: FormData) {
    "use server";
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();

    const intern_id = formData.get("intern_id") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const due_date = formData.get("due_date") as string;
    const priority = formData.get("priority") as string;
    const estimated_hours = formData.get("estimated_hours") ? Number(formData.get("estimated_hours")) : null;
    const resource_url = ((formData.get("resource_url") as string) ?? "").trim() || null;
    if (resource_url && !/^https?:\/\//i.test(resource_url)) throw new Error("Resource links must start with http(s)://");

    await supabase.from("intern_tasks").insert({
      intern_id,
      title,
      description,
      due_date,
      priority,
      status: "Assigned",
      assigned_by: actor.id,
      estimated_hours,
      resource_url,
    });
    await notify(intern_id, "New task assigned", `${title} · due ${formatDate(due_date)}`, "task");
    await logAction(actor.id, "task.assigned", "person", intern_id, { title });

    revalidatePath("/interns");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="Internship program"
        title="Interns,"
        dim="from day one to certificate."
        description="Cohorts, mentors, task assignments and completion — tracked end to end."
      >
        <Link href="/interns/postings" className="btn-secondary">
          <Link2 size={16} /> Openings & links
        </Link>
        <Link href="/interns/applications" className="btn-secondary">
          <FileText size={16} /> Applications
        </Link>
        <Link href="/people/new" className="btn-primary">
          <GraduationCap size={16} /> Register intern
        </Link>
      </PageHeader>

      {/* Recruitment Quick Nav Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/interns/postings"
          className="card p-5 group flex items-start justify-between hover:border-brand/50 transition-colors"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Link2 size={14} className="text-brand" />
              <span>Generate Shareable Links</span>
            </div>
            <h3 className="text-base font-medium text-text group-hover:text-brand-2 transition-colors flex items-center gap-1.5">
              Internship Openings & Links <ArrowRight size={14} />
            </h3>
            <p className="text-xs text-muted">
              Create role openings with custom links (/apply/[slug]) and CV upload forms.
            </p>
          </div>
        </Link>

        <Link
          href="/interns/applications"
          className="card p-5 group flex items-start justify-between hover:border-brand/50 transition-colors"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted">
              <FileText size={14} className="text-ok" />
              <span>Candidate Pipeline</span>
            </div>
            <h3 className="text-base font-medium text-text group-hover:text-brand-2 transition-colors flex items-center gap-1.5">
              Review Candidate Applications <ArrowRight size={14} />
            </h3>
            <p className="text-xs text-muted">
              Inspect submitted CVs/resumes, shortlist candidates, and convert directly to onboarding.
            </p>
          </div>
        </Link>
      </div>

      {/* Active interns */}
      <section className="space-y-5">
        <SectionHead index="01" title="Active interns" description={`${interns?.length || 0} in the program`} />
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="!pl-5">Intern</th>
                <th>Cohort</th>
                <th>Mentor</th>
                <th>Timeline</th>
                <th>Status</th>
                <th className="!pr-5"><span className="sr-only">Certificate</span></th>
              </tr>
            </thead>
            <tbody>
              {interns && interns.length > 0 ? (
                interns.map((intern) => (
                  <tr key={intern.id}>
                    <td className="!pl-5">
                      <Link href={`/people/${intern.id}`} className="group flex items-center gap-3">
                        <Avatar first={intern.first_name} last={intern.last_name} />
                        <div>
                          <div className="font-medium text-text transition-colors group-hover:text-brand-2">{intern.first_name} {intern.last_name}</div>
                          <div className="font-mono text-[11px] text-muted">{intern.employee_id}</div>
                        </div>
                      </Link>
                    </td>
                    <td>{intern.cohort || "—"}</td>
                    <td>
                      <form action={assignMentor}>
                        <input type="hidden" name="intern_id" value={intern.id} />
                        <AutoSubmitSelect name="mentor_id" defaultValue={intern.mentor_id || ""} aria-label={`Assign mentor for ${intern.first_name}`}>
                          <option value="">No mentor assigned</option>
                          {mentors?.map((mentor) => (
                            <option key={mentor.id} value={mentor.id}>
                              {mentor.first_name} {mentor.last_name} ({mentor.role})
                            </option>
                          ))}
                        </AutoSubmitSelect>
                      </form>
                    </td>
                    <td className="font-mono text-[11px] text-muted">
                      {intern.start_date || "—"} → {intern.end_date || "—"}
                    </td>
                    <td>
                      <StatusBadge status={intern.status} />
                    </td>
                    <td className="!pr-5 text-right">
                      {intern.status === "Completed" && (
                        <Link href={`/people/${intern.id}/completion`} className="btn-ghost text-xs" title="View completion certificate">
                          <Award size={14} className="text-ok" /> Certificate
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <Empty colSpan={6}>No interns registered yet.</Empty>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Task assignment */}
      <section className="space-y-5 border-t border-border pt-12">
        <SectionHead index="02" title="Assign task" description="Deliverable, due date and priority" />
        <form action={createTask} className="card space-y-5 p-7">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="label">Intern</label>
              <select name="intern_id" className="input" required>
                <option value="">Select an intern…</option>
                {interns?.map((intern) => (
                  <option key={intern.id} value={intern.id}>
                    {intern.first_name} {intern.last_name} ({intern.cohort || "Active"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Task title</label>
              <input type="text" name="title" className="input" placeholder="e.g. Design onboarding deck" required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <div>
              <label className="label">Due date</label>
              <input type="date" name="due_date" className="input" required />
            </div>
            <div>
              <label className="label">Estimated hours</label>
              <input type="number" name="estimated_hours" min="1" max="160" placeholder="e.g. 8" className="input" />
            </div>
            <div>
              <label className="label">Reference link (optional)</label>
              <input type="url" name="resource_url" placeholder="https://…" className="input" />
            </div>
            <div>
              <label className="label">Priority</label>
              <select name="priority" className="input" defaultValue="Medium">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description & deliverables</label>
            <textarea name="description" rows={3} className="input" placeholder="Objectives and expected outcomes…" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Assign task</button>
          </div>
        </form>
      </section>

      {/* Task backlog */}
      <section className="space-y-5 border-t border-border pt-12">
        <SectionHead index="03" title="Task backlog" description={`${tasks?.length || 0} tasks`} />
        {tasks && tasks.length > 0 ? (
          <ul className="border-t border-border">
            {tasks.map((task, i) => (
              <li key={task.id} className="grid grid-cols-[2rem_1fr] gap-x-4 gap-y-2 border-b border-border py-5 md:grid-cols-[2rem_1.2fr_1.5fr_auto] md:items-baseline">
                <span className="index pt-1">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-[17px] font-medium tracking-tight text-text">{task.title}</div>
                  <div className="text-[13px] text-muted">{task.people?.first_name} {task.people?.last_name}</div>
                </div>
                <p className="col-start-2 line-clamp-2 text-[13px] leading-relaxed text-muted md:col-start-auto">{task.description}</p>
                <div className="col-start-2 flex items-center gap-4 md:col-start-auto md:flex-col md:items-end md:gap-1.5">
                  <StatusBadge status={task.status} />
                  <span className="font-mono text-[11px] text-faint">Due {task.due_date} · {task.priority}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-border pt-5 text-[13px] text-muted">No tasks assigned yet.</p>
        )}
      </section>
    </div>
  );
}
