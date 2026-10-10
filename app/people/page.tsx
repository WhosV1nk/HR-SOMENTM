import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { UserPlus, Filter, Search, ArrowRight } from "lucide-react";

export default async function PeoplePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: people } = await supabase.from("people").select("*").order("first_name");

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="page-title text-white">People Directory</h1>
          <p className="mt-1 text-sm text-muted">Manage all employees, founders, contractors, and team members.</p>
        </div>
        <Link href="/people/new" className="btn-primary flex items-center gap-2">
          <UserPlus size={16} /> Add Person
        </Link>
      </div>

      {/* Directory Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-2/40">
          <div className="flex items-center gap-2 bg-surface-3 border border-border rounded-xl px-3 py-1.5 w-full md:w-72 text-xs">
            <Search size={14} className="text-muted" />
            <input type="text" placeholder="Search by name, role, email..." className="bg-transparent text-white focus:outline-none w-full" />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <Filter size={14} /> Total: <span className="font-semibold text-white">{people?.length || 0}</span>
          </div>
        </div>

        <table className="table w-full">
          <thead>
            <tr>
              <th>SOMENTM ID</th>
              <th>Person</th>
              <th>Type</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {people && people.length > 0 ? (
              people.map((person) => {
                const isFounder = person.employment_type === "Founder" || person.person_type === "Founder";
                const isIntern = person.person_type === "Intern";
                const isContractor = person.person_type === "Contractor";

                return (
                  <tr key={person.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="font-mono text-xs text-muted font-semibold">{person.employee_id}</td>
                    <td>
                      <Link href={`/people/${person.id}`} className="group flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-surface-3 border border-border flex items-center justify-center font-bold text-xs text-white">
                          {person.first_name[0]}{person.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-text group-hover:text-red-400 transition-colors">
                            {person.first_name} {person.last_name}
                          </div>
                          <div className="text-[11px] text-muted">{person.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${
                        isFounder
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : isIntern
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : isContractor
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-surface-3 text-muted border-border"
                      }`}>
                        {person.employment_type || person.person_type}
                      </span>
                    </td>
                    <td className="text-text font-medium text-xs capitalize">{person.department}</td>
                    <td className="text-text text-xs">{person.role}</td>
                    <td>
                      {person.status === "Active" && <span className="badge-success">🟢 Active</span>}
                      {person.status === "Onboarding" && (
                        <span className="badge-warning">🟡 Onboarding ({person.onboarding_progress || 20}%)</span>
                      )}
                      {person.status === "Probation" && <span className="badge-secondary">🔵 Probation</span>}
                    </td>
                    <td className="text-xs text-muted font-mono">{person.joined_date || "—"}</td>
                    <td>
                      <Link href={`/people/${person.id}`} className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1 hover:text-red-400">
                        View Profile <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted">
                  <div className="space-y-3">
                    <p>No people records found.</p>
                    <Link href="/people/new" className="btn-primary inline-flex items-center gap-2 text-xs">
                      <UserPlus size={14} /> Add First Person
                    </Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
