import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, SectionHead, StatusBadge } from "@/components/ui";

export default async function PortalPage() {
  const { person, isAdmin } = await requireViewer();
  const supabase = await createClient();

  // RLS returns only this person's mentor row (or nothing)
  const { data: mentor } = person.mentor_id
    ? await supabase.from("people").select("first_name, last_name, role").eq("id", person.mentor_id).maybeSingle()
    : { data: null };

  const details: [string, React.ReactNode][] = [
    ["SOMENTM ID", <span key="id" className="font-mono">{person.employee_id}</span>],
    ["Role", person.role],
    ["Department", <span key="d" className="capitalize">{person.department}</span>],
    ["Status", <StatusBadge key="s" status={person.status} />],
    ...(person.person_type === "Intern"
      ? ([
          ["Cohort", person.cohort || "—"],
          ["Internship", `${person.start_date || "—"} → ${person.end_date || "—"}`],
          ["Mentor", mentor ? `${mentor.first_name} ${mentor.last_name}` : "Not assigned yet"],
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow={person.person_type === "Intern" ? "Intern portal" : "Employee portal"}
        title={`Hi, ${person.first_name}.`}
        dim="Here's where you stand."
        description="Your tasks, attendance, leave, documents and reviews will live here."
      >
        {isAdmin && (
          <Link href="/" className="btn-secondary">
            HR dashboard <ArrowUpRight size={14} />
          </Link>
        )}
      </PageHeader>

      <section className="space-y-4">
        <SectionHead index="01" title="Your details" />
        <dl className="border-t border-border text-[14px]">
          {details.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 border-b border-border py-3.5">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right text-text">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] text-muted">Something wrong here? Ask HR to update it.</p>
      </section>
    </div>
  );
}
