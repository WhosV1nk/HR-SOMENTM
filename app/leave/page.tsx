import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { CalendarDays, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { revalidatePath } from "next/cache";

export default async function LeavePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: people } = await supabase.from("people").select("*").order("first_name");
  const { data: requests } = await supabase
    .from("leave_requests")
    .select("*, people(first_name, last_name, role, department)")
    .order("created_at", { ascending: false });

  async function createLeaveRequest(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const person_id = formData.get("person_id") as string;
    const leave_type = formData.get("leave_type") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;
    const reason = formData.get("reason") as string;

    await supabase.from("leave_requests").insert({
      person_id,
      leave_type,
      start_date,
      end_date,
      reason,
      status: "Pending",
    });

    revalidatePath("/leave");
  }

  async function updateLeaveStatus(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const id = formData.get("id") as string;
    const status = formData.get("status") as string;

    await supabase.from("leave_requests").update({ status }).eq("id", id);
    revalidatePath("/leave");
  }

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="page-title text-white">Leave Management</h1>
          <p className="mt-1 text-sm text-muted">Submit and manage employee & intern time-off requests.</p>
        </div>
      </div>

      {/* Submit Leave Request */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Plus size={18} className="text-red-400" /> Request Leave
        </h2>
        <form action={createLeaveRequest} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Person</label>
              <select name="person_id" className="input" required>
                <option value="">Select Person</option>
                {people?.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Leave Type</label>
              <select name="leave_type" className="input" required>
                <option value="Casual">Casual Leave</option>
                <option value="Sick">Sick Leave</option>
                <option value="Earned">Earned Leave</option>
                <option value="Unpaid">Unpaid Leave</option>
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" name="start_date" className="input" required />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" name="end_date" className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Reason / Notes</label>
            <input type="text" name="reason" className="input" placeholder="e.g. Medical appointment" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary flex items-center gap-2">
              <CalendarDays size={16} /> Submit Request
            </button>
          </div>
        </form>
      </div>

      {/* Leave Requests Log */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border/60 flex justify-between items-center bg-surface-2/40">
          <h2 className="text-sm font-semibold text-white">Leave Requests ({requests?.length || 0})</h2>
        </div>
        <table className="table w-full">
          <thead>
            <tr>
              <th>Person</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests && requests.length > 0 ? (
              requests.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-semibold text-text">{r.people?.first_name} {r.people?.last_name}</div>
                    <div className="text-[11px] text-muted">{r.people?.role}</div>
                  </td>
                  <td><span className="badge-secondary">{r.leave_type}</span></td>
                  <td className="font-mono text-xs text-muted">{r.start_date} $\rightarrow$ {r.end_date}</td>
                  <td className="text-xs text-muted max-w-xs truncate">{r.reason}</td>
                  <td>
                    {r.status === "Approved" && <span className="badge-success">🟢 Approved</span>}
                    {r.status === "Pending" && <span className="badge-warning">🟡 Pending</span>}
                    {r.status === "Rejected" && <span className="badge-danger">🔴 Rejected</span>}
                  </td>
                  <td>
                    {r.status === "Pending" ? (
                      <form action={updateLeaveStatus} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" name="status" value="Approved" className="btn-ghost text-xs py-1 px-2 text-emerald-400">Approve</button>
                        <button type="submit" name="status" value="Rejected" className="btn-ghost text-xs py-1 px-2 text-rose-400">Reject</button>
                      </form>
                    ) : (
                      <span className="text-xs text-muted font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted">No leave requests found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
