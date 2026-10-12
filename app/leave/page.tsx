import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { CalendarDays } from "lucide-react";
import { Avatar, Empty, PageHeader, SectionHead, StatusBadge } from "@/components/ui";
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

  const pending = requests?.filter((r) => r.status === "Pending").length || 0;

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="Time off"
        title="Leave,"
        dim="requested and approved."
        description="Submit time off for employees and interns, then approve or reject in one place."
      >
        <div className="status-pill">
          <span className={`inline-flex h-1.5 w-1.5 rounded-full ${pending ? "bg-warn" : "bg-muted"}`} />
          <b className="tabular-nums">{pending}</b> awaiting a decision
        </div>
      </PageHeader>

      <section className="space-y-5">
        <SectionHead index="01" title="Requests" description={`${requests?.length || 0} total`} />
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="!pl-5">Person</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="!pr-5"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {requests && requests.length > 0 ? (
                requests.map((r: any) => (
                  <tr key={r.id}>
                    <td className="!pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar first={r.people?.first_name} last={r.people?.last_name} />
                        <div>
                          <div className="font-medium text-text">{r.people?.first_name} {r.people?.last_name}</div>
                          <div className="text-[12px] text-muted">{r.people?.role}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="tag">{r.leave_type}</span></td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{r.start_date} → {r.end_date}</td>
                    <td className="max-w-xs truncate text-muted">{r.reason}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="!pr-5 text-right">
                      {r.status === "Pending" ? (
                        <form action={updateLeaveStatus} className="inline-flex items-center gap-2">
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" name="status" value="Approved" className="btn-primary btn-sm">Approve</button>
                          <button type="submit" name="status" value="Rejected" className="btn-ghost btn-sm hover:!text-brand-2">Reject</button>
                        </form>
                      ) : (
                        <span className="font-mono text-xs text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <Empty colSpan={6}>No leave requests yet.</Empty>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
        <div className="space-y-3">
          <SectionHead index="02" title="Request leave" />
          <p className="max-w-xs text-[13px] leading-relaxed text-muted">Log time off on someone&apos;s behalf. It lands as pending until approved above.</p>
        </div>
        <form action={createLeaveRequest} className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="label">Person</label>
              <select name="person_id" className="input" required>
                <option value="">Select person</option>
                {people?.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Leave type</label>
              <select name="leave_type" className="input" required>
                <option value="Casual">Casual leave</option>
                <option value="Sick">Sick leave</option>
                <option value="Earned">Earned leave</option>
                <option value="Unpaid">Unpaid leave</option>
              </select>
            </div>
            <div>
              <label className="label">Start date</label>
              <input type="date" name="start_date" className="input" required />
            </div>
            <div>
              <label className="label">End date</label>
              <input type="date" name="end_date" className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <input type="text" name="reason" className="input" placeholder="e.g. Medical appointment" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              <CalendarDays size={16} /> Submit request
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
