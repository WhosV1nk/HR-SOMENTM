import { createClient } from "@/utils/supabase/server";
import { logAction, requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { GraduationCap, Award } from "lucide-react";
import { Avatar, Empty, PageHeader, SectionHead, StatusBadge } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { revalidatePath } from "next/cache";

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

    await supabase.from("intern_tasks").insert({
      intern_id,
      title,
      description,
      due_date,
      priority,
      status: "Assigned",
      assigned_by: actor.id,
    });
    await logAction(actor.id, "task.assigned", "person", intern_id, { title });

    revalidatePath("/interns");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="Internship program"
        title="Interns,"
        dim="from day one to certificate."
        description="Cohorts, mentors, task assignments and completion — tracked end to end."
      >
        <Link href="/people/new" className="btn-primary">
          <GraduationCap size={16} /> Register intern
        </Link>
      </PageHeader>

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
                    <td>
                      <div className="text-text">{intern.cohort || "—"}</div>
                      <div className="text-[12px] text-muted">{intern.department}</div>
                    </td>
                    <td>
                      <form action={assignMentor}>
                        <input type="hidden" name="intern_id" value={intern.id} />
                        <AutoSubmitSelect
                          name="mentor_id"
                          defaultValue={intern.mentor_id || ""}
                          aria-label={`Mentor for ${intern.first_name}`}
                          className="input w-44 rounded-full py-1.5 text-[13px]"
                        >
                          <option value="">Unassigned</option>
                          {mentors?.map(m => (
                            <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                          ))}
                        </AutoSubmitSelect>
                      </form>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">
                      {intern.start_date || "—"} → {intern.end_date || "—"}
                    </td>
                    <td><StatusBadge status={intern.status} /></td>
                    <td className="!pr-5 text-right">
                      <button className="btn-ghost btn-sm">
                        <Award size={14} /> Certificate
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <Empty colSpan={6}>No active interns.</Empty>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Assign task */}
      <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
        <div className="space-y-3">
          <SectionHead index="02" title="Assign a task" />
          <p className="max-w-xs text-[13px] leading-relaxed text-muted">Give an intern a deliverable with a due date and priority. It shows up on their profile straight away.</p>
        </div>
        <form action={createTask} className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="label">Intern</label>
              <select name="intern_id" className="input" required>
                <option value="">Select intern</option>
                {interns?.map(i => (
                  <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Task title</label>
              <input type="text" name="title" className="input" placeholder="e.g. Campaign analytics report" required />
            </div>
            <div>
              <label className="label">Due date</label>
              <input type="date" name="due_date" className="input" required />
            </div>
            <div>
              <label className="label">Priority</label>
              <select name="priority" className="input" required>
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
