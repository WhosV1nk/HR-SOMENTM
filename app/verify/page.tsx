import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { IrisBackdrop, Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Verify a certificate · SOMENTM" };

async function lookUp(fd: FormData) {
  "use server";
  const code = ((fd.get("code") as string) ?? "").trim().toUpperCase().replace(/\s+/g, "");
  redirect(`/verify/${encodeURIComponent(code || "-")}`);
}

export default function VerifyPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16">
      <IrisBackdrop />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8 text-center">
        <Wordmark sub="Certificate verification" href="/verify" size="lg" />
        <h1 className="display text-4xl">
          Is it genuine?<span className="headline-dim"> Check in seconds.</span>
        </h1>
        <p className="text-[15px] text-muted">Enter the code printed on a SOMENTM certificate or letter of recommendation, or scan its QR code.</p>
        <form action={lookUp} className="flex w-full gap-2">
          <input
            name="code"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="SOM-2026-XXXX-XXXX"
            className="input rounded-full font-mono uppercase tracking-wider"
            aria-label="Verification code"
          />
          <button className="btn-primary shrink-0"><ShieldCheck size={16} /> Verify</button>
        </form>
      </div>
    </div>
  );
}
