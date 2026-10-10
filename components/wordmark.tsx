import Link from "next/link";

/**
 * SomenTm brand mark — the real logo + tracked wordmark, exactly as on the public
 * landing page. `sub` names the product surface (Fleet Shield, Admin portal…).
 */
export function Wordmark({ sub, href = "/", className = "", size = "md" }: { sub?: string; href?: string; className?: string; size?: "md" | "lg" }) {
  const img = size === "lg" ? "h-9" : "h-7";
  return (
    <Link href={href} className={`flex items-center gap-3 ${className}`} aria-label="SomenTm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/somentm-logo.png" alt="" className={`${img} w-auto`} />
      <span className="leading-tight">
        <span className={`wordmark block ${size === "lg" ? "text-[16px]" : ""}`}>SOMENTM</span>
        {sub && <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{sub}</span>}
      </span>
    </Link>
  );
}

/** Status readout with a live dot — "Control room · online". Plain text, no capsule. */
export function StatusPill({ label, detail, tone = "live", className = "" }: { label: string; detail?: string; tone?: "live" | "danger" | "idle"; className?: string }) {
  return (
    <span className={`status-pill ${className}`}>
      <span className="relative flex h-3 w-3 items-center justify-center">
        {tone === "idle" ? <span className="inline-flex h-1.5 w-1.5 rounded-full bg-muted" /> : <span className={`live-dot ${tone === "danger" ? "danger" : ""}`} />}
      </span>
      <b>{label}</b>
      {detail && <span>· {detail}</span>}
    </span>
  );
}

/** The halftone iris + warm bloom behind auth and gate screens. Parent must be `relative overflow-hidden`. */
export function IrisBackdrop({ size = "min(90vw, 640px)" }: { size?: string }) {
  return (
    <>
      <div aria-hidden className="iris left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2" style={{ width: size }} />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,59,59,0.16), transparent 60%)" }}
      />
    </>
  );
}
