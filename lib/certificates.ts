import "server-only";
import type { Person } from "@/lib/auth";
import { logAction } from "@/lib/auth";
import { renderCertificate, renderRecommendation } from "@/lib/certificate-pdf";
import { appUrl } from "@/lib/email";
import { storeFile } from "@/lib/files";
import { notify } from "@/lib/notify";
import { createAdminClient } from "@/utils/supabase/admin";

export type CertificateRow = {
  id: string;
  person_id: string;
  code: string;
  status: "Draft" | "Pending Approval" | "Issued" | "Revoked";
  full_name: string;
  role: string;
  department: string;
  start_date: string | null;
  end_date: string | null;
  final_score: number | null;
  grade: string | null;
  include_lor: boolean;
  lor_text: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
  issued_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  certificate_doc_id: string | null;
  lor_doc_id: string | null;
};

export const verifyUrl = (code: string) => new URL(`/verify/${code}`, appUrl()).toString();

/** Only people flagged can_issue_certificates (founders by default) give final approval. */
export function canApprove(person: Person) {
  return person.access_role === "admin" && person.status === "Active" && person.can_issue_certificates === true;
}

async function storePdf(personId: string, bytes: Uint8Array, name: string) {
  const file = new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
  return storeFile(personId, file, "certificates");
}

/**
 * Render and store the certificate (and letter, if included), record them as
 * issued documents, and mark the internship completed. Runs with the service
 * role *after* the caller has checked canApprove().
 */
export async function issueCertificate(cert: CertificateRow, approver: Person) {
  const admin = createAdminClient();
  if (cert.status !== "Pending Approval" && cert.status !== "Draft") throw new Error(`This certificate is already ${cert.status.toLowerCase()}.`);
  if (!cert.signatory_name || !cert.signatory_title) throw new Error("Add the signatory's name and title.");
  if (cert.include_lor && !cert.lor_text?.trim()) throw new Error("The letter of recommendation is empty.");
  if (cert.include_lor && cert.lor_text?.includes("[Add a specific example")) throw new Error("Replace the placeholder line in the letter of recommendation first.");

  const issuedAt = new Date().toISOString();
  const data = {
    code: cert.code,
    fullName: cert.full_name,
    role: cert.role,
    department: cert.department,
    startDate: cert.start_date,
    endDate: cert.end_date,
    grade: cert.grade,
    issuedAt,
    signatoryName: cert.signatory_name,
    signatoryTitle: cert.signatory_title,
    verifyUrl: verifyUrl(cert.code),
  };
  const slug = cert.full_name.replace(/[^\w]+/g, "-");

  const certFile = await storePdf(cert.person_id, await renderCertificate(data), `SOMENTM-Certificate-${slug}.pdf`);
  const { data: certDoc, error: e1 } = await admin
    .from("documents")
    .insert({
      person_id: cert.person_id,
      kind: "certificate",
      title: "Certificate of Internship Completion",
      file_path: certFile.path,
      file_name: certFile.name,
      mime_type: "application/pdf",
      size_bytes: certFile.size,
      status: "Issued",
      uploaded_by: approver.id,
    })
    .select("id")
    .single();
  if (e1) throw new Error(`Couldn't save the certificate: ${e1.message}`);

  let lorDocId: string | null = null;
  if (cert.include_lor && cert.lor_text) {
    const lorFile = await storePdf(cert.person_id, await renderRecommendation({ ...data, body: cert.lor_text }), `SOMENTM-Recommendation-${slug}.pdf`);
    const { data: lorDoc, error: e2 } = await admin
      .from("documents")
      .insert({
        person_id: cert.person_id,
        kind: "recommendation",
        title: "Letter of Recommendation",
        file_path: lorFile.path,
        file_name: lorFile.name,
        mime_type: "application/pdf",
        size_bytes: lorFile.size,
        status: "Issued",
        uploaded_by: approver.id,
      })
      .select("id")
      .single();
    if (e2) throw new Error(`Couldn't save the letter: ${e2.message}`);
    lorDocId = lorDoc.id;
  }

  const { data: updated, error: e3 } = await admin
    .from("certificates")
    .update({
      status: "Issued",
      approved_by: approver.id,
      issued_at: issuedAt,
      certificate_doc_id: certDoc.id,
      lor_doc_id: lorDocId,
      updated_at: issuedAt,
    })
    .eq("id", cert.id)
    .in("status", ["Draft", "Pending Approval"]) // guards a double click / race
    .select("id")
    .maybeSingle();
  if (e3 || !updated) throw new Error("Couldn't finalise the certificate. It may have been issued already.");

  await admin.from("people").update({ status: "Completed" }).eq("id", cert.person_id);
  await notify(
    cert.person_id,
    "Your certificate is ready",
    `Congratulations! Your internship certificate${lorDocId ? " and letter of recommendation are" : " is"} available in your portal.`,
    "certificate",
  );
  await logAction(approver.id, "certificate.issued", "person", cert.person_id, { code: cert.code, lor: Boolean(lorDocId) });
}

export async function revokeCertificate(cert: CertificateRow, actor: Person, reason: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("certificates")
    .update({ status: "Revoked", revoked_at: new Date().toISOString(), revoke_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", cert.id)
    .eq("status", "Issued")
    .select("id")
    .maybeSingle();
  if (!data) throw new Error("Only an issued certificate can be revoked.");
  // the files stay in storage for the record, but leave the person's document list
  const ids = [cert.certificate_doc_id, cert.lor_doc_id].filter(Boolean) as string[];
  if (ids.length) await admin.from("documents").delete().in("id", ids);
  await notify(cert.person_id, "Certificate revoked", reason, "certificate");
  await logAction(actor.id, "certificate.revoked", "person", cert.person_id, { code: cert.code, reason });
}
