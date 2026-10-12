import Link from "next/link";
import { CheckCircle2, Circle, Download, Upload } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, SectionHead, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { uploadDocument } from "../actions";
import { ActionForm } from "@/components/action-form";
import { KIND_LABEL } from "@/lib/documents";

export default async function PortalDocumentsPage() {
  const { person } = await requireViewer();
  const supabase = await createClient();
  const isIntern = person.person_type === "Intern";

  const [{ data: docs }, { data: sub }] = await Promise.all([
    supabase.from("documents").select("*").eq("person_id", person.id).order("created_at", { ascending: false }),
    supabase.from("onboarding_submissions").select("submitted, agreement_signed").eq("person_id", person.id).maybeSingle(),
  ]);

  const uploaded = docs?.filter((d) => d.status !== "Issued") ?? [];
  const issued = docs?.filter((d) => d.status === "Issued") ?? [];
  const has = (kind: string, status?: string) => uploaded.some((d) => d.kind === kind && (!status || d.status === status));

  const checklist = [
    { label: "Personal & emergency details submitted", done: Boolean(sub?.submitted) },
    { label: "Agreement accepted", done: Boolean(sub?.agreement_signed) },
    { label: "Identity proof uploaded", done: has("identity") },
    { label: "Identity proof verified by HR", done: has("identity", "Verified") },
    ...(isIntern ? [{ label: "Student ID uploaded", done: has("student_id") }] : []),
    { label: "Activated by HR", done: person.status === "Active" || person.status === "Completed" },
  ];
  const done = checklist.filter((c) => c.done).length;
  const rejected = uploaded.filter((d) => d.status === "Rejected");

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader eyebrow="Records" title="Documents," dim="private and verified." description="Only you and HR can see these files. Uploading a document doesn't verify it; HR reviews each one." />

      {rejected.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
          <span className="live-dot danger mt-1.5" />
          <div>
            HR couldn&apos;t accept {rejected.length === 1 ? "a document" : `${rejected.length} documents`}:{" "}
            {rejected.map((d) => `${KIND_LABEL[d.kind]}${d.rejection_reason ? ` (${d.rejection_reason})` : ""}`).join(", ")}. Please upload a new copy.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <section className="space-y-5">
          <SectionHead index="01" title="Onboarding">
            <span className="font-mono text-[12px] text-muted">{done}/{checklist.length}</span>
          </SectionHead>
          <div className="h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${(done / checklist.length) * 100}%` }} />
          </div>
          <ul className="space-y-3 text-[14px]">
            {checklist.map((c) => (
              <li key={c.label} className={`flex items-start gap-2.5 ${c.done ? "text-text" : "text-muted"}`}>
                {c.done ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" /> : <Circle size={16} className="mt-0.5 shrink-0 text-faint" />}
                {c.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5 lg:col-span-2">
          <SectionHead index="02" title="From HR" description="Offer letter, agreement and other letters issued to you." />
          <ul className="border-t border-border">
            {issued.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 border-b border-border py-4">
                <div>
                  <div className="font-medium text-text">{d.title}</div>
                  <div className="font-mono text-[11px] text-faint">{KIND_LABEL[d.kind]} · {formatDate(d.created_at)}</div>
                </div>
                <Link href={`/files/document/${d.id}`} className="btn-secondary btn-sm"><Download size={14} /> Open</Link>
              </li>
            ))}
            {!issued.length && <li className="py-4 text-[13px] text-muted">Nothing issued yet.</li>}
          </ul>
        </section>
      </div>

      <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
        <div className="space-y-3">
          <SectionHead index="03" title="Your uploads" />
          <ActionForm action={uploadDocument} className="space-y-4">
            <div>
              <label className="label">Document</label>
              <select name="kind" className="input" required>
                <option value="identity">Identity proof (Aadhaar / passport / govt ID)</option>
                {isIntern && <option value="student_id">Student ID card</option>}
                <option value="resume">Résumé</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Title (optional)</label>
              <input name="title" className="input" placeholder="e.g. Aadhaar front & back" />
            </div>
            <div>
              <label className="label">File · PDF or image, max 4 MB</label>
              <input type="file" name="file" accept="application/pdf,image/*" required className="input text-xs file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black" />
            </div>
            <button className="btn-primary w-full"><Upload size={15} /> Upload</button>
          </ActionForm>
        </div>
        <ul className="border-t border-border lg:col-span-2">
          {uploaded.map((d) => (
            <li key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border py-4">
              <div className="min-w-0">
                <Link href={`/files/document/${d.id}`} className="block truncate font-medium text-text hover:text-brand-2">{d.title}</Link>
                <div className="font-mono text-[11px] text-faint">{KIND_LABEL[d.kind]} · {formatDate(d.created_at)}</div>
                {d.status === "Rejected" && d.rejection_reason && <div className="mt-1 text-[12px] text-brand-2">{d.rejection_reason}</div>}
              </div>
              <StatusBadge status={d.status === "Verified" ? "Approved" : d.status} label={d.status === "Pending" ? "Awaiting HR" : d.status} />
            </li>
          ))}
          {!uploaded.length && <li className="py-4 text-[13px] text-muted">No documents uploaded yet.</li>}
        </ul>
      </section>
    </div>
  );
}
