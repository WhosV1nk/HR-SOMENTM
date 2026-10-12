import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Circle, Download } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, SectionHead } from "@/components/ui";
import { formatDate, internshipProgress, todayIST } from "@/lib/time";
import { verifyUrl } from "@/lib/certificates";

export default async function PortalCertificatePage() {
  const { person } = await requireViewer();
  if (person.person_type !== "Intern") redirect("/portal");
  const supabase = await createClient();
  const today = todayIST();

  const [{ data: certs }, { data: finalReview }] = await Promise.all([
    supabase.from("certificates").select("*").eq("person_id", person.id).neq("status", "Revoked").order("created_at", { ascending: false }).limit(1),
    supabase.from("performance_reviews").select("id").eq("person_id", person.id).eq("review_type", "final").limit(1),
  ]);
  const cert = certs?.[0] ?? null;
  const issued = cert?.status === "Issued";
  const progress = internshipProgress(person.start_date, person.end_date, today);

  const steps = [
    { label: "Internship completed", done: Boolean(person.end_date && person.end_date <= today) || issued, detail: person.end_date ? `Ends ${formatDate(person.end_date)}` : undefined },
    { label: "Final evaluation by your mentor / HR", done: Boolean(finalReview?.length) || issued },
    { label: "Certificate prepared by HR", done: Boolean(cert) },
    { label: "Approved and issued", done: issued, detail: issued ? formatDate(cert!.issued_at) : cert?.status === "Pending Approval" ? "Waiting for approval" : undefined },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="Records"
        title={issued ? "Congratulations," : "Your certificate,"}
        dim={issued ? `${person.first_name}.` : "on its way."}
        description={
          issued
            ? "Your internship certificate is ready. Share the verification link so anyone can confirm it's genuine."
            : "Once your internship ends and your final evaluation is done, HR prepares your certificate for approval."
        }
      />

      {issued ? (
        <section className="card space-y-6 p-6 md:p-8">
          <div className="flex flex-wrap gap-3">
            {cert.certificate_doc_id && (
              <Link href={`/files/document/${cert.certificate_doc_id}`} className="btn-primary"><Download size={16} /> Download certificate</Link>
            )}
            {cert.lor_doc_id && (
              <Link href={`/files/document/${cert.lor_doc_id}`} className="btn-secondary"><Download size={16} /> Letter of recommendation</Link>
            )}
          </div>
          <dl className="border-t border-border text-[14px]">
            <div className="flex justify-between gap-4 border-b border-border py-3"><dt className="text-muted">Final evaluation</dt><dd>{cert.grade ?? "—"}</dd></div>
            <div className="flex justify-between gap-4 border-b border-border py-3"><dt className="text-muted">Verification code</dt><dd className="font-mono">{cert.code}</dd></div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted">Public link</dt>
              <dd className="min-w-0 truncate"><a href={verifyUrl(cert.code)} target="_blank" rel="noreferrer" className="link">{verifyUrl(cert.code).replace(/^https?:\/\//, "")} <ArrowUpRight size={14} /></a></dd>
            </div>
          </dl>
          <p className="text-[12px] text-muted">Add the public link to your résumé or LinkedIn. It shows your name, role, dates and grade, nothing else.</p>
        </section>
      ) : (
        progress !== null && (
          <div className="space-y-2">
            <div className="h-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${progress}%` }} />
            </div>
            <div className="font-mono text-[11px] text-faint">{progress}% of your internship</div>
          </div>
        )
      )}

      <section className="space-y-5">
        <SectionHead index="01" title="Steps" />
        <ol className="border-t border-border">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-4 border-b border-border py-4">
              <span className="index pt-1">{String(i + 1).padStart(2, "0")}</span>
              {s.done ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-ok" /> : <Circle size={17} className="mt-0.5 shrink-0 text-faint" />}
              <div>
                <div className={s.done ? "text-text" : "text-muted"}>{s.label}</div>
                {s.detail && <div className="text-[12px] text-faint">{s.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
