import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { Avatar, PageHeader, SectionHead, StatusBadge } from "@/components/ui";
import { formatDate, todayIST } from "@/lib/time";
import { canApprove } from "@/lib/certificates";

type Row = { id: string; first_name: string; last_name: string; role: string; department: string; end_date: string | null; status: string };

export default async function CertificatesPage() {
  const { person: viewer } = await requireAdmin();
  const supabase = await createClient();
  const today = todayIST();
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 21 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: interns }, { data: certs }] = await Promise.all([
    supabase.from("people").select("id, first_name, last_name, role, department, end_date, status").eq("person_type", "Intern").order("end_date"),
    supabase.from("certificates").select("id, person_id, code, status, grade, issued_at, full_name").order("updated_at", { ascending: false }),
  ]);

  const live = new Map(certs?.filter((c) => c.status !== "Revoked").map((c) => [c.person_id, c]));
  const pending = certs?.filter((c) => c.status === "Pending Approval") ?? [];
  const drafts = certs?.filter((c) => c.status === "Draft") ?? [];
  const issued = certs?.filter((c) => c.status === "Issued") ?? [];
  const due = ((interns ?? []) as Row[]).filter(
    (p) => !live.has(p.id) && p.status !== "Completed" && p.status !== "Terminated" && p.end_date && p.end_date <= soon,
  );
  const approver = canApprove(viewer);

  const row = (href: string, name: string, sub: string, right: React.ReactNode, key: string) => (
    <li key={key} className="border-b border-border">
      <Link href={href} className="group flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar first={name.split(" ")[0]} last={name.split(" ").slice(-1)[0]} />
          <div>
            <div className="font-medium text-text group-hover:text-brand-2">{name}</div>
            <div className="font-mono text-[11px] text-faint">{sub}</div>
          </div>
        </div>
        {right}
      </Link>
    </li>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="Performance"
        title="Certificates,"
        dim="earned and verifiable."
        description="Interns finishing soon, certificates waiting for approval, and everything issued, each with a public verification code."
      >
        <Link href="/verify" target="_blank" className="btn-secondary">Public verify page <ArrowUpRight size={14} /></Link>
      </PageHeader>

      <section className="space-y-5">
        <SectionHead index="01" title="Waiting for approval" description={approver ? "You can approve these." : "An approver needs to sign these off."} />
        <ul className="border-t border-border">
          {pending.map((c) => row(`/people/${c.person_id}/completion`, c.full_name, `${c.code} · ${c.grade ?? ""}`, <StatusBadge status="Pending" label="Needs approval" />, c.id))}
          {!pending.length && <li className="py-4 text-[13px] text-muted">Nothing waiting.</li>}
        </ul>
      </section>

      <section className="space-y-5">
        <SectionHead index="02" title="Finishing soon" description="Ending in the next three weeks (or already ended) with no certificate started." />
        <ul className="border-t border-border">
          {due.map((p) =>
            row(
              `/people/${p.id}/completion`,
              `${p.first_name} ${p.last_name}`,
              `${p.role} · ends ${formatDate(p.end_date)}`,
              <span className={`link ${p.end_date! < today ? "text-brand-2" : "text-muted"}`}>Start <ArrowUpRight size={14} /></span>,
              p.id,
            ),
          )}
          {drafts.map((c) => row(`/people/${c.person_id}/completion`, c.full_name, `Draft · ${c.code}`, <StatusBadge status="Assigned" label="Draft" />, c.id))}
          {!due.length && !drafts.length && <li className="py-4 text-[13px] text-muted">No one is finishing soon.</li>}
        </ul>
      </section>

      <section className="space-y-5">
        <SectionHead index="03" title="Issued" description={`${issued.length} certificate${issued.length === 1 ? "" : "s"}`} />
        <ul className="border-t border-border">
          {issued.map((c) => row(`/people/${c.person_id}/completion`, c.full_name, `${c.code} · ${formatDate(c.issued_at)}`, <StatusBadge status="Approved" label={c.grade ?? "Issued"} />, c.id))}
          {!issued.length && <li className="py-4 text-[13px] text-muted">None issued yet.</li>}
        </ul>
      </section>
    </div>
  );
}
