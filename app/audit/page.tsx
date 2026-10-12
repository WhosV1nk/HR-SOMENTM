import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { Empty, PageHeader } from "@/components/ui";

export default async function AuditPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("audit_log")
    .select("*, actor:people!audit_log_actor_id_fkey(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="System"
        title="Audit log,"
        dim="every important change."
        description="Who added, approved, deactivated or reviewed what — and when. Most recent 200 entries."
      />

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="!pl-5">When</th>
              <th>Who</th>
              <th>Action</th>
              <th className="!pr-5">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries && entries.length > 0 ? (
              entries.map((e) => (
                <tr key={e.id}>
                  <td className="!pl-5 whitespace-nowrap font-mono text-xs text-muted">
                    {new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                  </td>
                  <td className="text-text">{e.actor ? `${e.actor.first_name} ${e.actor.last_name}` : <span className="text-muted">System</span>}</td>
                  <td><span className="tag !text-text">{e.action}</span></td>
                  <td className="!pr-5 max-w-md truncate font-mono text-[11px] text-muted">
                    {e.details ? JSON.stringify(e.details) : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <Empty colSpan={4}>Nothing logged yet.</Empty>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
