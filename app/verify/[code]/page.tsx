import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ShieldX, SearchX } from "lucide-react";
import { createAdminClient } from "@/utils/supabase/admin";
import { IrisBackdrop, Wordmark } from "@/components/wordmark";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Verify a certificate · SOMENTM", robots: { index: false } };

const CODE = /^SOM-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/**
 * Public. Reads with the service role but returns only what the certificate
 * itself states — never contact details or internal records.
 */
export default async function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).trim().toUpperCase();
  const cert = CODE.test(code)
    ? (
        await createAdminClient()
          .from("certificates")
          .select("code, status, full_name, role, department, start_date, end_date, grade, include_lor, lor_doc_id, signatory_name, signatory_title, issued_at, revoked_at")
          .eq("code", code)
          .in("status", ["Issued", "Revoked"])
          .maybeSingle()
      ).data
    : null;

  const valid = cert?.status === "Issued";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16">
      <IrisBackdrop />
      <div className="relative z-10 w-full max-w-xl space-y-8">
        <div className="flex justify-center">
          <Wordmark sub="Certificate verification" href="/verify" size="lg" />
        </div>

        {!cert ? (
          <div className="card space-y-4 p-8 text-center">
            <SearchX className="mx-auto text-muted" size={28} />
            <h1 className="display text-3xl">No certificate found<span className="headline-dim"> for this code.</span></h1>
            <p className="font-mono text-sm text-muted">{code || "—"}</p>
            <p className="text-[14px] text-muted">Check the code on the document (format SOM-YYYY-XXXX-XXXX) and try again.</p>
            <Link href="/verify" className="btn-secondary">Try another code</Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className={`flex items-center gap-3 px-6 py-4 ${valid ? "bg-ok-soft" : "bg-danger-soft"}`}>
              {valid ? <ShieldCheck className="text-ok" size={22} /> : <ShieldX className="text-brand-2" size={22} />}
              <div>
                <div className="font-medium">{valid ? "Valid certificate" : "This certificate has been revoked"}</div>
                <div className="font-mono text-[12px] text-muted">{cert.code}</div>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div>
                <div className="eyebrow">Certificate of internship completion</div>
                <h1 className="display mt-3 text-4xl">{cert.full_name}</h1>
              </div>
              <dl className="border-t border-border text-[14px]">
                {[
                  ["Role", cert.role],
                  ["Team", cert.department],
                  ["Internship", `${formatDate(cert.start_date)} → ${formatDate(cert.end_date)}`],
                  ["Final evaluation", cert.grade ?? "—"],
                  ["Letter of recommendation", cert.include_lor && cert.lor_doc_id ? "Issued" : "Not issued"],
                  ["Issued", formatDate(cert.issued_at)],
                  ["Approved by", `${cert.signatory_name}, ${cert.signatory_title}`],
                  ...(cert.status === "Revoked" ? [["Revoked", formatDate(cert.revoked_at)]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-border py-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right text-text">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[12px] text-muted">
                Issued by SOMENTM. If the details on the document you were given differ from this page, the document has been altered.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
