/** SOMENTM runs on India time; all "today"s are IST regardless of server region. */
export const TZ = "Asia/Kolkata";

/** YYYY-MM-DD for now (or `d`) in IST. */
export function todayIST(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "14 Oct 2026" from a YYYY-MM-DD string. */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Whole days from `a` to `b` (YYYY-MM-DD), inclusive of both. */
export function daysInclusive(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
}

export const WEEKLY_OFF = new Set([0, 6]); // Sunday, Saturday

/** Internship progress 0–100 from start/end dates, or null if dates are missing. */
export function internshipProgress(start: string | null, end: string | null, today = todayIST()) {
  if (!start || !end) return null;
  const total = daysInclusive(start, end);
  if (total <= 0) return null;
  const done = Math.min(Math.max(daysInclusive(start, today), 0), total);
  return Math.round((done / total) * 100);
}
