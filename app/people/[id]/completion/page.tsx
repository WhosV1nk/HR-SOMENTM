import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowUpRight, CheckCircle2, Circle, Download, AlertTriangle, ShieldCheck } from "lucide-react";
import { logAction, requireAdmin } from "@/lib/auth";
import { attempt, type ActionResult } from "@/lib/action-result";
import { ActionForm } from "@/components/action-form";
import { notify } from "@/lib/notify";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, SectionHead, Stat, StatusBadge } from "@/components/ui";
import { formatDate, todayIST } from "@/lib/time";
import {
  CERTIFICATE_PASS_SCORE,
  LOR_MIN_SCORE,
  completionChecks,
  draftRecommendation,
  gradeFor,
  newCertificateCode,
} from "@/lib/completion";
import { CompletionButtons as ActionButtons } from "./buttons";
import { canApprove, issueCertificate, revokeCertificate, verifyUrl, type CertificateRow } from "@/lib/certificates";

export default async function CompletionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { person: viewer } = await requireAdmin();
  const supabase = await createClient();
  const today = todayIST();

  const { data: person } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (!person) notFound();
  if (person.person_type !== "Intern") redirect(`/people/${id}`);

  const [{ data: reviews }, { data: tasks }, { data: pendingSubs }, { data: identity }, { data: certs }, { data: approverRows }] = await Promise.all([
    supabase.from("performance_reviews").select("*").eq("person_id", id).order("created_at", { ascending: false }),
    supabase.from("intern_tasks").select("id, status").eq("intern_id", id),
    supabase.from("task_submissions").select("id").eq("submitted_by", id).eq("review_status", "Pending"),
    supabase.from("documents").select("id").eq("person_id", id).eq("kind", "identity").eq("status", "Verified").limit(1),
    supabase.from("certificates").select("*").eq("person_id", id).order("created_at", { ascending: false }),
    supabase.from("people").select("first_name, last_name").eq("can_issue_certificates", true).eq("status", "Active"),
  ]);

  const finalReview = reviews?.find((r) => r.review_type === "final") ?? null;
  const finalScore = finalReview ? Number(finalReview.overall_score) : null;
  const grade = finalScore !== null ? gradeFor(finalScore) : null;
  const approvedTasks = tasks?.filter((t) => t.status === "Approved").length ?? 0;
  const openTasks = (tasks?.length ?? 0) - approvedTasks;
  const cert = (certs?.find((c) => c.status !== "Revoked") ?? null) as CertificateRow | null;
  const revoked = (certs?.filter((c) => c.status === "Revoked") ?? []) as CertificateRow[];
  const checks = completionChecks({
    finalScore,
    endDate: person.end_date,
    today,
    openTasks,
    pendingReviews: pendingSubs?.length ?? 0,
    identityVerified: Boolean(identity?.length),
  });
  const blocked = checks.some((c) => c.blocking && !c.ok);
  const iCanApprove = canApprove(viewer);
  const fullName = `${person.first_name} ${person.last_name}`;
  const lorSuggested = finalScore !== null && finalScore >= LOR_MIN_SCORE;
  const editable = !cert || cert.status === "Draft" || cert.status === "Pending Approval";

  const defaultLor = draftRecommendation({
    firstName: person.first_name,
    fullName,
    role: person.role,
    department: person.department,
    startDate: person.start_date,
    endDate: person.end_date,
    grade,
    approvedTasks,
    scores: {
      task: finalReview?.task_completion_score ?? null,
      quality: finalReview?.quality_score ?? null,
      communication: finalReview?.communication_score ?? null,
      initiative: finalReview?.initiative_score ?? null,
    },
  });

  // ------------------------------------------------------------ actions

  /** Save the editable fields; creates the draft on first save. Returns the row. */
  async function save(fd: FormData, status?: CertificateRow["status"]) {
    "use server";
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();
    const fields = {
      full_name: ((fd.get("full_name") as string) || fullName).trim(),
      role: ((fd.get("role") as string) || person.role).trim(),
      department: ((fd.get("department") as string) || person.department).trim(),
      start_date: (fd.get("start_date") as string) || person.start_date,
      end_date: (fd.get("end_date") as string) || person.end_date,
      final_score: finalScore,
      grade,
      include_lor: fd.get("include_lor") === "on",
      lor_text: ((fd.get("lor_text") as string) ?? "").trim() || null,
      signatory_name: ((fd.get("signatory_name") as string) ?? "").trim() || null,
      signatory_title: ((fd.get("signatory_title") as string) ?? "").trim() || null,
      updated_at: new Date().toISOString(),
      ...(status ? { status } : {}),
      ...(status === "Pending Approval" ? { submitted_at: new Date().toISOString() } : {}),
    };
    if (cert) {
      const { data, error } = await supabase
        .from("certificates")
        .update(fields)
        .eq("id", cert.id)
        .in("status", ["Draft", "Pending Approval"])
        .select("*")
        .single();
      if (error) throw new Error(`Couldn't save: ${error.message}`);
      return data as CertificateRow;
    }
    const { data, error } = await supabase
      .from("certificates")
      .insert({ ...fields, person_id: id, code: newCertificateCode(), status: status ?? "Draft", prepared_by: actor.id })
      .select("*")
      .single();
    if (error) throw new Error(`Couldn't save: ${error.message}`);
    await logAction(actor.id, "certificate.drafted", "person", id);
    return data as CertificateRow;
  }

  async function saveDraft(_prev: ActionResult, fd: FormData) {
    "use server";
    return attempt(async () => {
      await save(fd);
      revalidatePath(`/people/${id}/completion`);
      return "Draft saved.";
    });
  }

  async function submitForApproval(_prev: ActionResult, fd: FormData) {
    "use server";
    return attempt(async () => {
      if (blocked) throw new Error("Resolve the blocking items in the checklist first.");
      const { person: actor } = await requireAdmin();
      await save(fd, "Pending Approval");
      await notify(null, "Certificate awaiting approval", `${fullName} · ${grade ?? ""}`, "certificate");
      await logAction(actor.id, "certificate.submitted", "person", id);
      revalidatePath(`/people/${id}/completion`);
      revalidatePath("/certificates");
      return "Sent for approval.";
    });
  }

  async function approveAndIssue(_prev: ActionResult, fd: FormData) {
    "use server";
    return attempt(async () => {
      const { person: actor } = await requireAdmin();
      if (!canApprove(actor)) throw new Error("Only an approver can issue certificates.");
      if (blocked) throw new Error("Resolve the blocking items in the checklist first.");
      const row = await save(fd);
      await issueCertificate(row, actor);
      revalidatePath(`/people/${id}/completion`);
      revalidatePath(`/people/${id}`);
      revalidatePath("/certificates");
      return "Issued. The intern has been notified.";
    });
  }

  async function returnToDraft(_prev: ActionResult, _fd: FormData) {
    "use server";
    return attempt(async () => {
      const { person: actor } = await requireAdmin();
      const supabase = await createClient();
      await supabase.from("certificates").update({ status: "Draft" }).eq("id", cert!.id).eq("status", "Pending Approval");
      await logAction(actor.id, "certificate.returned", "person", id);
      revalidatePath(`/people/${id}/completion`);
    });
  }

  async function revoke(_prev: ActionResult, fd: FormData) {
    "use server";
    return attempt(async () => {
      const { person: actor } = await requireAdmin();
      if (!canApprove(actor)) throw new Error("Only an approver can revoke certificates.");
      const reason = ((fd.get("reason") as string) ?? "").trim();
      if (!reason) throw new Error("Give a reason for revoking.");
      await revokeCertificate(cert!, actor, reason);
      revalidatePath(`/people/${id}/completion`);
      revalidatePath("/certificates");
    });
  }

  async function endWithoutCertificate(_prev: ActionResult, _fd: FormData) {
    "use server";
    return attempt(async () => {
      const { person: actor } = await requireAdmin();
      const supabase = await createClient();
      await supabase.from("people").update({ status: "Completed" }).eq("id", id);
      await logAction(actor.id, "internship.ended_without_certificate", "person", id);
      revalidatePath(`/people/${id}/completion`);
      return "Internship marked as ended. No certificate was issued.";
    });
  }

  // ------------------------------------------------------------ view

  const v = (k: keyof CertificateRow, fallback: string | null) => (cert?.[k] as string | null) ?? fallback ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        back={{ href: `/people/${id}`, label: fullName }}
        eyebrow="Internship completion"
        title="Certificate"
        dim={`for ${person.first_name}.`}
        description={`Final evaluation → HR prepares → ${approverRows?.length ? approverRows.map((a) => a.first_name).join(" / ") : "an approver"} approves → certificate${lorSuggested ? " and letter" : ""} issued with a public verification code.`}
      >
        <StatusBadge status={cert?.status === "Issued" ? "Approved" : cert?.status === "Pending Approval" ? "Pending" : cert ? "Assigned" : undefined} label={cert?.status ?? "Not started"} />
      </PageHeader>

      <section className="stat-strip">
        <Stat label="Final score" value={finalScore !== null ? Math.round(finalScore) : "—"} unit={finalScore !== null ? "/ 100" : undefined} hint={finalReview ? `${finalReview.period} · final review` : "No final review yet"} />
        <Stat label="Grade" value={grade ?? "—"} hint={`Pass ${CERTIFICATE_PASS_SCORE}+ · Merit 75+ · Distinction 90+`} />
        <Stat label="Tasks approved" value={approvedTasks} unit={`/ ${tasks?.length ?? 0}`} />
        <Stat label="Internship" value={formatDate(person.end_date)} hint={`Started ${formatDate(person.start_date)}`} />
      </section>

      {cert?.status === "Issued" && (
        <section className="card space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-ok" size={22} />
              <div>
                <div className="text-lg font-medium tracking-tight">Issued {formatDate(cert.issued_at)}</div>
                <div className="font-mono text-[12px] text-muted">{cert.code}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {cert.certificate_doc_id && <Link href={`/files/document/${cert.certificate_doc_id}`} className="btn-primary btn-sm"><Download size={14} /> Certificate</Link>}
              {cert.lor_doc_id && <Link href={`/files/document/${cert.lor_doc_id}`} className="btn-secondary btn-sm"><Download size={14} /> Letter</Link>}
              <a href={verifyUrl(cert.code)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Public page <ArrowUpRight size={14} /></a>
            </div>
          </div>
          {iCanApprove && (
            <ActionForm action={revoke} className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <input name="reason" placeholder="Reason for revoking" className="input w-72 rounded-full py-1.5 text-[13px]" />
              <button className="btn-danger btn-sm">Revoke certificate</button>
              <span className="text-[12px] text-muted">The public page will show it as revoked.</span>
            </ActionForm>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <section className="space-y-5">
          <SectionHead index="01" title="Checklist" />
          <ul className="space-y-3.5 text-[14px]">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5">
                {c.ok ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" />
                ) : c.blocking ? (
                  <Circle size={16} className="mt-0.5 shrink-0 text-brand-2" />
                ) : (
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
                )}
                <div>
                  <div className={c.ok ? "text-text" : "text-muted"}>{c.label}</div>
                  {c.detail && <div className="text-[12px] text-faint">{c.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[12px] leading-relaxed text-muted">
            <Circle size={11} className="inline text-brand-2" /> blocks issuing. <AlertTriangle size={11} className="inline text-warn" /> is a warning you can knowingly override.
          </p>
          {!finalReview && (
            <Link href="/performance" className="link">Add the final review <ArrowUpRight size={14} /></Link>
          )}
        </section>

        <section className="space-y-5 lg:col-span-2">
          <SectionHead index="02" title={editable ? "Certificate details" : "What was issued"} />
          {editable ? (
            <form className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Name on certificate</label>
                  <input name="full_name" defaultValue={v("full_name", fullName)} className="input" required />
                </div>
                <div>
                  <label className="label">Role</label>
                  <input name="role" defaultValue={v("role", person.role)} className="input" required />
                </div>
                <div>
                  <label className="label">Department</label>
                  <input name="department" defaultValue={v("department", person.department)} className="input" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">From</label>
                    <input type="date" name="start_date" defaultValue={v("start_date", person.start_date)} className="input" />
                  </div>
                  <div>
                    <label className="label">To</label>
                    <input type="date" name="end_date" defaultValue={v("end_date", person.end_date)} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Signatory name</label>
                  <input name="signatory_name" defaultValue={v("signatory_name", `${viewer.first_name} ${viewer.last_name}`)} className="input" required />
                </div>
                <div>
                  <label className="label">Signatory title</label>
                  <input name="signatory_title" defaultValue={v("signatory_title", viewer.role)} className="input" required />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-5">
                <label className="flex items-center gap-2.5 text-[14px]">
                  <input type="checkbox" name="include_lor" defaultChecked={cert ? cert.include_lor : lorSuggested} className="h-4 w-4" />
                  Include a letter of recommendation
                  <span className="text-[12px] text-muted">
                    {lorSuggested ? `· suggested (score ${LOR_MIN_SCORE}+)` : `· usually for scores ${LOR_MIN_SCORE}+`}
                  </span>
                </label>
                <textarea name="lor_text" rows={12} defaultValue={v("lor_text", defaultLor)} className="input font-[inherit] leading-relaxed" />
                <p className="text-[12px] text-muted">Separate paragraphs with a blank line. Replace the bracketed line with a real example; issuing is blocked until you do.</p>
              </div>

              {/* each button posts the same fields to a different action */}
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
                <ActionButtons
                  saveDraft={saveDraft}
                  submit={cert?.status === "Pending Approval" ? null : submitForApproval}
                  approve={iCanApprove ? approveAndIssue : null}
                  returnToDraft={cert?.status === "Pending Approval" ? returnToDraft : null}
                  blocked={blocked}
                />
              </div>
              {!iCanApprove && cert?.status === "Pending Approval" && (
                <p className="text-right text-[13px] text-muted">Waiting for {approverRows?.map((a) => `${a.first_name} ${a.last_name}`).join(" or ") || "an approver"} to approve.</p>
              )}
            </form>
          ) : (
            <dl className="border-t border-border text-[14px]">
              {[
                ["Name", cert?.full_name],
                ["Role", cert?.role],
                ["Department", cert?.department],
                ["Dates", `${formatDate(cert?.start_date)} → ${formatDate(cert?.end_date)}`],
                ["Grade", cert?.grade ?? "—"],
                ["Signed by", `${cert?.signatory_name}, ${cert?.signatory_title}`],
                ["Letter of recommendation", cert?.include_lor ? "Included" : "Not included"],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right">{val}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      {revoked.length > 0 && (
        <section className="space-y-4 border-t border-border pt-10">
          <SectionHead index="03" title="Revoked" />
          <ul className="border-t border-border text-[13px]">
            {revoked.map((r) => (
              <li key={r.id} className="flex justify-between gap-4 border-b border-border py-3">
                <span className="font-mono text-muted">{r.code}</span>
                <span className="text-muted">{formatDate(r.revoked_at)} · {r.revoke_reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editable && person.status !== "Completed" && (
        <section className="border-t border-border pt-10">
          <ActionForm action={endWithoutCertificate} className="flex flex-wrap items-center gap-3">
            <button className="btn-ghost btn-sm">End internship without a certificate</button>
            <span className="text-[12px] text-muted">For interns who leave early or don&apos;t meet the bar. They keep read-only access to their records.</span>
          </ActionForm>
        </section>
      )}
    </div>
  );
}

