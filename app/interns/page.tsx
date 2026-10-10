import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { GraduationCap, Award, Plus, CheckCircle2, Clock } from "lucide-react";
import { revalidatePath } from "next/cache";

export default async function InternsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: interns } = await supabase.from("people").select("*").eq("person_type", "Intern").order("first_name");
  const { data: mentors } = await supabase.from("people").select("*").eq("person_type", "Employee");
  const { data: tasks } = await supabase.from("intern_tasks").select("*, people:intern_id(first_name, last_name)");

  async function assignMentor(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const intern_id = formData.get("intern_id") as string;
    const mentor_id = formData.get("mentor_id") as string;

    await supabase.from("people").update({ mentor_id }).eq("id", intern_id);
    revalidatePath("/interns");
  }

  async function createTask(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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
    });

    revalidatePath("/interns");
  }

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="page-title text-white">Internship Management Engine</h1>
          <p className="mt-1 text-sm text-muted">Cohort tracking, mentor assignments, task evaluation, and certificate generation.</p>
        </div>
        <Link href="/people/new" className="btn-primary flex items-center gap-2">
          <GraduationCap size={16} /> Register Intern
        </Link>
      </div>

      {/* Assign Task Card */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Plus size={18} className="text-red-400" /> Assign New Task to Intern
        </h2>
        <form action={createTask} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Intern</label>
              <select name="intern_id" className="input" required>
                <option value="">Select Intern</option>
                {interns?.map(i => (
                  <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Task Title</label>
              <input type="text" name="title" className="input" placeholder="e.g. Campaign Analytics Report" required />
            </div>
            <div>
              <label className="label">Due Date</label>
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
            <label className="label">Task Description & Deliverables</label>
            <textarea name="description" rows={2} className="input" placeholder="Enter task objectives and expected outcomes..." required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Assign Task</button>
          </div>
        </form>
      </div>

      {/* Interns List */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-surface-2/40">
          <h2 className="text-sm font-semibold text-white">Active Interns ({interns?.length || 0})</h2>
        </div>

        <table className="table w-full">
          <thead>
            <tr>
              <th>Intern</th>
              <th>Cohort & Focus</th>
              <th>Mentor</th>
              <th>Timeline</th>
              <th>Status</th>
              <th>Certificate</th>
            </tr>
          </thead>
          <tbody>
            {interns && interns.length > 0 ? (
              interns.map((intern) => {
                const currentMentor = mentors?.find(m => m.id === intern.mentor_id);

                return (
                  <tr key={intern.id}>
                    <td>
                      <div className="font-semibold text-text">{intern.first_name} {intern.last_name}</div>
                      <div className="text-[11px] text-muted">{intern.employee_id} • {intern.email}</div>
                    </td>
                    <td>
                      <div className="text-text font-medium text-xs">{intern.cohort || "Summer 2026"}</div>
                      <div className="text-[11px] text-muted">{intern.department}</div>
                    </td>
                    <td>
                      <form action={assignMentor} className="flex items-center gap-2">
                        <input type="hidden" name="intern_id" value={intern.id} />
                        <select 
                          name="mentor_id" 
                          defaultValue={intern.mentor_id || ""} 
                          onChange={(e) => e.target.form?.requestSubmit()}
                          className="bg-surface-3 text-xs rounded-lg px-2 py-1 border border-border text-white focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {mentors?.map(m => (
                            <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                          ))}
                        </select>
                      </form>
                    </td>
                    <td className="font-mono text-xs text-muted">
                      {intern.start_date || "Jul 17"} $\rightarrow$ {intern.end_date || "Jan 16"}
                    </td>
                    <td>
                      <span className="badge-success">🟢 Active</span>
                    </td>
                    <td>
                      <button className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1 text-red-400">
                        <Award size={14} /> Certificate
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted">No active interns found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Intern Tasks Log */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-4">Task Backlog & Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tasks && tasks.length > 0 ? (
            tasks.map(task => (
              <div key={task.id} className="card p-4 bg-surface-2/60 border border-border/60 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-white">{task.title}</span>
                  <span className="badge-secondary text-[10px]">{task.priority}</span>
                </div>
                <div className="text-[11px] text-muted">Assigned to: {task.people?.first_name} {task.people?.last_name}</div>
                {task.description && (
                  <p className="text-[11px] text-muted/80 line-clamp-2 italic pt-1">{task.description}</p>
                )}
                <div className="flex justify-between items-center pt-2 text-[11px] border-t border-border/40">
                  <span className="text-muted font-mono">Due: {task.due_date}</span>
                  <span className="badge-warning text-[10px]">{task.status}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-8 text-muted text-xs">No tasks currently assigned.</div>
          )}
        </div>
      </div>

    </div>
  );
}
