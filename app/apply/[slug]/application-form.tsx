"use client";

import { useState, useRef } from "react";
import { submitApplication, type ApplicationResponse } from "../actions";
import { CopyButton } from "@/components/copy-button";
import { 
  UploadCloud, 
  FileText, 
  X, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  Briefcase,
  Calendar,
  Clock,
  MapPin,
  DollarSign
} from "lucide-react";

type Opening = {
  id: string;
  slug: string;
  title: string;
  department: string;
  cohort: string | null;
  duration: string | null;
  location: string | null;
  stipend: string | null;
  description: string;
  requirements: string | null;
  perks: string | null;
};

export function ApplicationForm({ opening }: { opening: Opening }) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<ApplicationResponse, { ok: true }> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(selectedFile: File | null) {
    if (!selectedFile) return;

    if (selectedFile.size > 4 * 1024 * 1024) {
      setErrorMessage(`"${selectedFile.name}" is over 4 MB. Please upload a smaller file.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setErrorMessage(null);
    setFile(selectedFile);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelection(droppedFile);
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        fileInputRef.current.files = dataTransfer.files;
      }
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setErrorMessage("Please select and upload your CV or Resume to continue.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("opening_id", opening.id);
    // Explicitly attach the state file to ensure it's present
    formData.set("resume", file);

    const res = await submitApplication(formData);
    setIsSubmitting(false);

    if (res.ok) {
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setErrorMessage(res.error || "Failed to submit your application. Please try again.");
    }
  }

  if (result) {
    return (
      <div className="card space-y-8 p-8 md:p-12 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-ok/30 bg-ok-soft text-ok">
          <CheckCircle2 size={40} />
        </div>

        <div className="space-y-3">
          <div className="eyebrow mx-auto justify-center">Application Received</div>
          <h2 className="display text-3xl md:text-4xl">
            You&apos;re in the running, <span className="headline-dim">{result.candidate_name}.</span>
          </h2>
          <p className="mx-auto max-w-lg text-[15px] text-muted">
            Your application for <strong>{result.opening_title}</strong> at SOMENTM has been safely received.
          </p>
        </div>

        {/* Reference Code Card */}
        <div className="card-2 mx-auto max-w-md space-y-4 p-6 text-left border border-border">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <span className="text-xs uppercase tracking-wider text-muted font-mono">Reference Number</span>
            <CopyButton text={result.application_no} label="Copy Ref" copiedLabel="Copied" />
          </div>
          <div className="text-2xl font-mono font-medium tracking-wide text-text">
            {result.application_no}
          </div>
          <div className="space-y-1.5 pt-2 text-xs text-muted">
            <div className="flex justify-between">
              <span>Position:</span>
              <strong className="text-text">{opening.title}</strong>
            </div>
            <div className="flex justify-between">
              <span>Cohort:</span>
              <span className="text-text">{opening.cohort || "Active"}</span>
            </div>
            <div className="flex justify-between">
              <span>Confirmation sent to:</span>
              <span className="text-text font-mono truncate max-w-[200px]">{result.email}</span>
            </div>
          </div>
        </div>

        {/* Process Timeline */}
        <div className="mx-auto max-w-xl space-y-4 pt-4 text-left">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted">What happens next?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-2 p-4 space-y-2">
              <span className="index text-xs">01</span>
              <h4 className="text-sm font-medium text-text">Resume Review</h4>
              <p className="text-xs text-muted">Our engineering and HR leads review your profile and experience.</p>
            </div>
            <div className="card-2 p-4 space-y-2">
              <span className="index text-xs">02</span>
              <h4 className="text-sm font-medium text-text">Conversation</h4>
              <p className="text-xs text-muted">Shortlisted candidates receive an invite for a brief technical chat.</p>
            </div>
            <div className="card-2 p-4 space-y-2">
              <span className="index text-xs">03</span>
              <h4 className="text-sm font-medium text-text">Offer & Invite</h4>
              <p className="text-xs text-muted">Selected candidates receive an invite link directly into the SOMENTM portal.</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted pt-6">
          Have questions regarding your application? Contact our team at{" "}
          <a href="mailto:careers@somentm.com" className="link font-medium">careers@somentm.com</a> quoting reference{" "}
          <span className="font-mono text-text">{result.application_no}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {errorMessage && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-text">
          <span className="live-dot danger shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 01: Candidate Identity */}
      <section className="card p-6 md:p-8 space-y-6">
        <div className="flex items-baseline gap-3 border-b border-border pb-4">
          <span className="index">01</span>
          <div>
            <h3 className="text-lg font-medium tracking-tight">Your Details</h3>
            <p className="text-xs text-muted">Let us know who you are and where we can reach you.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="label">First Name *</label>
            <input
              type="text"
              name="first_name"
              required
              placeholder="e.g. Alex"
              className="input"
            />
          </div>
          <div>
            <label className="label">Last Name *</label>
            <input
              type="text"
              name="last_name"
              required
              placeholder="e.g. Rivera"
              className="input"
            />
          </div>
          <div>
            <label className="label">Email Address *</label>
            <input
              type="email"
              name="email"
              required
              placeholder="alex@university.edu"
              className="input"
            />
            <p className="mt-1 text-[11px] text-faint">We will use this email for interview scheduling and updates.</p>
          </div>
          <div>
            <label className="label">Phone / WhatsApp Number *</label>
            <input
              type="tel"
              name="phone"
              required
              placeholder="+91 98765 43210"
              className="input"
            />
          </div>
        </div>
      </section>

      {/* 02: Education & Academic Background */}
      <section className="card p-6 md:p-8 space-y-6">
        <div className="flex items-baseline gap-3 border-b border-border pb-4">
          <span className="index">02</span>
          <div>
            <h3 className="text-lg font-medium tracking-tight">Education</h3>
            <p className="text-xs text-muted">Your current university, course, and expected graduation.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="label">College / University *</label>
            <input
              type="text"
              name="university"
              required
              placeholder="e.g. National Institute of Technology / Stanford University"
              className="input"
            />
          </div>
          <div>
            <label className="label">Degree & Major *</label>
            <input
              type="text"
              name="degree"
              required
              placeholder="e.g. B.Tech Computer Science / B.Des Product Design"
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Graduation Year *</label>
              <input
                type="text"
                name="graduation_year"
                required
                placeholder="e.g. 2026"
                className="input font-mono"
              />
            </div>
            <div>
              <label className="label">GPA / % (Optional)</label>
              <input
                type="text"
                name="gpa"
                placeholder="e.g. 8.8 / 10"
                className="input font-mono"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 03: Online Profiles & Portfolios */}
      <section className="card p-6 md:p-8 space-y-6">
        <div className="flex items-baseline gap-3 border-b border-border pb-4">
          <span className="index">03</span>
          <div>
            <h3 className="text-lg font-medium tracking-tight">Profiles & Work</h3>
            <p className="text-xs text-muted">Links to where your projects, code, or design work live.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="label">LinkedIn Profile</label>
            <input
              type="url"
              name="linkedin_url"
              placeholder="https://linkedin.com/in/username"
              className="input text-xs"
            />
          </div>
          <div>
            <label className="label">GitHub Profile</label>
            <input
              type="url"
              name="github_url"
              placeholder="https://github.com/username"
              className="input text-xs"
            />
          </div>
          <div>
            <label className="label">Portfolio / Personal Site</label>
            <input
              type="url"
              name="portfolio_url"
              placeholder="https://yourportfolio.dev"
              className="input text-xs"
            />
          </div>
        </div>
      </section>

      {/* 04: Resume / CV Upload Box (Prominent & Drag-Drop) */}
      <section className="card p-6 md:p-8 space-y-6">
        <div className="flex items-baseline justify-between border-b border-border pb-4">
          <div className="flex items-baseline gap-3">
            <span className="index">04</span>
            <div>
              <h3 className="text-lg font-medium tracking-tight">CV / Resume Upload *</h3>
              <p className="text-xs text-muted">Upload your latest resume highlighting relevant projects and skills.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-muted">PDF / Word · Max 4 MB</span>
        </div>

        {/* Drag & Drop Container */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 md:p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-brand bg-brand-soft/20 scale-[0.99]"
              : file
              ? "border-ok/40 bg-surface-2"
              : "border-border hover:border-text/40 hover:bg-surface-2/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            name="resume"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
          />

          {!file ? (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-2 text-muted group-hover:text-text group-hover:scale-105 transition-all">
                <UploadCloud size={28} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-text">
                  Drag and drop your CV here, or <span className="text-brand underline underline-offset-4">browse files</span>
                </p>
                <p className="text-xs text-muted">Accepts PDF, DOC, DOCX up to 4 MB</p>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-4 p-4 rounded-xl border border-ok/30 bg-ok-soft/30 w-full max-w-md mx-auto text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-1 border border-border text-ok">
                <FileText size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate">{file.name}</p>
                <p className="text-xs text-muted font-mono">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="p-1.5 rounded-full hover:bg-surface-2 text-muted hover:text-text transition-colors"
                title="Remove file"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Candidate Cover Note / Pitch */}
        <div className="space-y-2 pt-2">
          <label className="label">Note or Pitch to the Team (Optional)</label>
          <textarea
            name="cover_note"
            rows={3}
            placeholder="Tell us briefly about an interesting project you built or why you'd like to intern at SOMENTM..."
            className="input resize-none py-2.5 text-xs leading-relaxed"
          />
        </div>
      </section>

      {/* Submit Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-xs text-muted">
          By submitting, you agree to SOMENTM evaluating your profile for internship opportunities.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full sm:w-auto px-8 py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-surface-1 border-t-transparent" />
              Submitting Application...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Submit Application
            </>
          )}
        </button>
      </div>
    </form>
  );
}
