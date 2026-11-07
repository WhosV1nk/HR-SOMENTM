import { createAdminClient } from "@/utils/supabase/admin";
import { IrisBackdrop, Wordmark } from "@/components/wordmark";
import { ApplicationForm } from "./application-form";
import Link from "next/link";
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Sparkles, 
  Building2,
  Lock
} from "lucide-react";

export default async function PublicApplicationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: opening } = await admin
    .from("internship_openings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!opening || opening.status !== "Active") {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-6">
        <IrisBackdrop />
        <div className="card relative z-10 w-full max-w-md space-y-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-2 text-muted">
            <Lock size={24} />
          </div>
          <div className="space-y-2">
            <h1 className="display text-2xl">Opening Closed or Not Found</h1>
            <p className="text-xs text-muted leading-relaxed">
              This internship opening is no longer accepting applications or the link may have expired.
            </p>
          </div>
          <div className="pt-2">
            <a href="https://somentm.com" className="btn-secondary text-xs">
              Visit SOMENTM.com
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Parse requirements and perks into arrays if newline-separated
  const requirementsList = opening.requirements
    ? opening.requirements.split("\n").map((r: string) => r.trim()).filter(Boolean)
    : [];

  const perksList = opening.perks
    ? opening.perks.split("\n").map((p: string) => p.trim()).filter(Boolean)
    : [];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-text px-4 py-12 md:py-16">
      <IrisBackdrop />

      <main className="relative z-10 mx-auto max-w-4xl space-y-12">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-border pb-6">
          <Wordmark sub="Careers & Internships" />
          <div className="flex items-center gap-2">
            <span className="live-dot ok" />
            <span className="text-xs font-mono uppercase tracking-wider text-ok">Applications Open</span>
          </div>
        </header>

        {/* Hero Banner for Opening */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="badge-brand font-medium">{opening.department}</span>
              {opening.cohort && <span className="badge-muted">{opening.cohort}</span>}
              {opening.duration && <span className="badge-muted">{opening.duration}</span>}
            </div>
            <h1 className="display text-4xl md:text-5xl tracking-tight">
              {opening.title}
            </h1>
          </div>

          {/* Key Facts Pill Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card-2 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <MapPin size={13} /> Location
              </div>
              <div className="text-sm font-medium text-text">{opening.location || "Remote"}</div>
            </div>
            <div className="card-2 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Clock size={13} /> Duration
              </div>
              <div className="text-sm font-medium text-text">{opening.duration || "3 Months"}</div>
            </div>
            <div className="card-2 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Calendar size={13} /> Cohort
              </div>
              <div className="text-sm font-medium text-text">{opening.cohort || "Active"}</div>
            </div>
            <div className="card-2 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <DollarSign size={13} /> Stipend
              </div>
              <div className="text-sm font-medium text-text">{opening.stipend || "Competitive"}</div>
            </div>
          </div>
        </div>

        {/* Role Overview & Details */}
        <div className="card p-6 md:p-8 space-y-8">
          {/* Description */}
          <div className="space-y-3">
            <h2 className="text-lg font-medium tracking-tight">About the Role</h2>
            <div className="text-sm text-muted leading-relaxed whitespace-pre-line">
              {opening.description}
            </div>
          </div>

          {/* Requirements */}
          {requirementsList.length > 0 && (
            <div className="space-y-3 border-t border-border pt-6">
              <h2 className="text-lg font-medium tracking-tight">What We Look For</h2>
              <ul className="space-y-2 text-sm text-muted">
                {requirementsList.map((req: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-brand shrink-0 mt-1">▪</span>
                    <span>{req.replace(/^[-*•]\s*/, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Perks & Offerings */}
          {perksList.length > 0 && (
            <div className="space-y-3 border-t border-border pt-6">
              <h2 className="text-lg font-medium tracking-tight">What You Can Expect at SOMENTM</h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted">
                {perksList.map((perk: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5 card-2 p-3">
                    <Sparkles size={16} className="text-brand shrink-0 mt-0.5" />
                    <span className="text-xs text-text">{perk.replace(/^[-*•]\s*/, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* The Application Form & CV Upload */}
        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <div className="eyebrow">Application Form</div>
            <h2 className="display text-3xl">Submit Your Candidacy</h2>
            <p className="text-xs text-muted">Complete the fields below and attach your CV/resume to apply.</p>
          </div>
          <ApplicationForm opening={opening} />
        </div>

        {/* Footer */}
        <footer className="border-t border-border pt-8 text-center text-xs text-muted">
          <p>© {new Date().getFullYear()} SOMENTM Inc. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
