import { createClient } from "@/utils/supabase/server";
import { logAction, requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { UserPlus, Search, ArrowUpRight } from "lucide-react";
import { Avatar, Empty, PageHeader, StatusBadge } from "@/components/ui";

export default async function PeoplePage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: people } = await supabase.from("people").select("*").order("first_name");

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="People"
        title="Everyone,"
        dim="in one place."
        description="Employees, founders, contractors and interns — with their status, role and onboarding progress."
      >
        <Link href="/people/new" className="btn-primary">
          <UserPlus size={16} /> Add person
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <label className="flex w-full items-center gap-2.5 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-sm md:w-80">
          <Search size={15} className="text-faint" />
          <input type="text" placeholder="Search by name, role, email…" className="w-full bg-transparent text-text outline-none placeholder:text-faint" />
        </label>
        <div className="status-pill">
          <b className="tabular-nums">{people?.length || 0}</b> people on record
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="!pl-5">Person</th>
              <th>ID</th>
              <th>Type</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th className="!pr-5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {people && people.length > 0 ? (
              people.map((person) => (
                <tr key={person.id}>
                  <td className="!pl-5">
                    <Link href={`/people/${person.id}`} className="group flex items-center gap-3">
                      <Avatar first={person.first_name} last={person.last_name} />
                      <div>
                        <div className="font-medium text-text transition-colors group-hover:text-brand-2">
                          {person.first_name} {person.last_name}
                        </div>
                        <div className="text-[12px] text-muted">{person.email}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-muted">{person.employee_id}</td>
                  <td><span className="tag">{person.employment_type || person.person_type}</span></td>
                  <td className="capitalize text-muted">{person.department}</td>
                  <td className="text-text">{person.role}</td>
                  <td>
                    <StatusBadge
                      status={person.status}
                      label={person.status === "Onboarding" ? `Onboarding · ${person.onboarding_progress || 20}%` : undefined}
                    />
                  </td>
                  <td className="font-mono text-xs text-muted">{person.joined_date || "—"}</td>
                  <td className="!pr-5 text-right">
                    <Link href={`/people/${person.id}`} className="link text-muted">
                      Profile <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <Empty colSpan={8}>
                <p className="mb-4">No one here yet.</p>
                <Link href="/people/new" className="btn-primary btn-sm">
                  <UserPlus size={14} /> Add the first person
                </Link>
              </Empty>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
