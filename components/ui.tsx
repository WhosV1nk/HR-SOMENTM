import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * Editorial building blocks lifted from the somentm.com landing page:
 * two-tone medium-weight headlines, mono index numerals, hairline rules,
 * and dot-status labels (never emoji, never capsules).
 */

/** Page header — eyebrow, two-tone headline ("People" + dim "directory."), lede, actions. */
export function PageHeader({
  eyebrow,
  title,
  dim,
  description,
  back,
  children,
}: {
  eyebrow?: string;
  title: string;
  dim?: string;
  description?: string;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-5 border-b border-border pb-8">
      {back && (
        <Link href={back.href} className="link text-muted">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-4">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="display text-4xl md:text-5xl">
            {title}
            {dim && <span className="headline-dim"> {dim}</span>}
          </h1>
          {description && <p className="max-w-xl text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {children && <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>}
      </div>
    </header>
  );
}

/** Section heading — mono index, title, optional lede and a trailing link/action. */
export function SectionHead({
  index,
  title,
  description,
  href,
  hrefLabel,
  children,
}: {
  index?: string;
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-baseline gap-3">
        {index && <span className="index">{index}</span>}
        <div>
          <h2 className="text-xl font-medium tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      {href && (
        <Link href={href} className="link shrink-0">
          {hrefLabel ?? "View all"} <ArrowUpRight size={14} />
        </Link>
      )}
      {children}
    </div>
  );
}

/** One cell of a `.stat-strip` — big number, mono unit, muted caption. */
export function Stat({ label, value, unit, hint }: { label: string; value: React.ReactNode; unit?: string; hint?: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-3">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {hint && <div className="mt-2 text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  Active: "badge-ok",
  Present: "badge-ok",
  Approved: "badge-ok",
  Completed: "badge-brand",
  Excellent: "badge-ok",
  "Exceeds Expectations": "badge-ok",
  Good: "badge-brand",
  Onboarding: "badge-warn",
  Late: "badge-warn",
  "Half Day": "badge-warn",
  Pending: "badge-warn",
  Assigned: "badge-warn",
  "In Progress": "badge-brand",
  Probation: "badge-brand",
  "On Leave": "badge-brand",
  "Work From Home": "badge-brand",
  Absent: "badge-danger",
  Rejected: "badge-danger",
  Terminated: "badge-danger",
  "Needs Improvement": "badge-danger",
  High: "badge-danger",
  Medium: "badge-warn",
  Low: "badge-muted",
};

/** Dot + label status readout. `label` overrides the displayed text. */
export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
  const s = status || "Not Marked";
  return <span className={STATUS_TONE[s] ?? "badge-muted"}>{label ?? (s === "Work From Home" ? "WFH" : s)}</span>;
}

/** Initials avatar — neutral surface, no colour coding. */
export function Avatar({ first, last, size = "md" }: { first?: string | null; last?: string | null; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-20 w-20 rounded-[20px] text-2xl" : "h-9 w-9 rounded-full text-[11px]";
  return (
    <div className={`flex shrink-0 items-center justify-center border border-border bg-surface-2 font-medium tracking-tight text-text ${cls}`}>
      {first?.[0]}
      {last?.[0]}
    </div>
  );
}

/** Empty table row / panel message. */
export function Empty({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  const body = <div className="py-12 text-center text-[13px] text-muted">{children}</div>;
  return colSpan ? (
    <tr>
      <td colSpan={colSpan} className="!border-b-0">{body}</td>
    </tr>
  ) : (
    body
  );
}
