import { formatDate } from "@/lib/time";

/** Policy — edit here. Scores are the weighted overall score of the *final* review (0–100). */
export const CERTIFICATE_PASS_SCORE = 60;
export const LOR_MIN_SCORE = 75;

export function gradeFor(score: number) {
  if (score >= 90) return "Distinction";
  if (score >= 75) return "Merit";
  if (score >= CERTIFICATE_PASS_SCORE) return "Pass";
  return null;
}

type Check = { label: string; ok: boolean; blocking: boolean; detail?: string };

/**
 * What must be true before a certificate can be issued. Blocking checks stop
 * submission for approval; the rest are warnings HR can knowingly override.
 */
export function completionChecks(input: {
  finalScore: number | null;
  endDate: string | null;
  today: string;
  openTasks: number;
  pendingReviews: number;
  identityVerified: boolean;
}): Check[] {
  const { finalScore, endDate, today, openTasks, pendingReviews, identityVerified } = input;
  return [
    {
      label: "Final evaluation submitted",
      ok: finalScore !== null,
      blocking: true,
      detail: finalScore === null ? "Add a review of type Final on the Performance page." : `Score ${Math.round(finalScore)}/100`,
    },
    {
      label: `Final score at least ${CERTIFICATE_PASS_SCORE}`,
      ok: finalScore !== null && finalScore >= CERTIFICATE_PASS_SCORE,
      blocking: true,
    },
    {
      label: "No submissions waiting for review",
      ok: pendingReviews === 0,
      blocking: true,
      detail: pendingReviews ? `${pendingReviews} waiting on Review work` : undefined,
    },
    {
      label: "Internship end date reached",
      ok: Boolean(endDate && endDate <= today),
      blocking: false,
      detail: endDate ? `Ends ${formatDate(endDate)}` : "No end date set",
    },
    { label: "All tasks approved", ok: openTasks === 0, blocking: false, detail: openTasks ? `${openTasks} still open` : undefined },
    { label: "Identity verified", ok: identityVerified, blocking: false },
  ];
}

/** Human-friendly verification code, e.g. SOM-2026-7KQ4-M2XD (no 0/O/1/I). */
export function newCertificateCode(year = new Date().getFullYear()) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `SOM-${year}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** A starting draft for the letter of recommendation. HR edits it before approval. */
export function draftRecommendation(p: {
  firstName: string;
  fullName: string;
  role: string;
  department: string;
  startDate: string | null;
  endDate: string | null;
  grade: string | null;
  approvedTasks: number;
  scores: { task: number | null; quality: number | null; communication: number | null; initiative: number | null };
}) {
  const { firstName, fullName, role, department, startDate, endDate, grade, approvedTasks, scores } = p;
  const strengths = (
    [
      ["dependable, on-time delivery", scores.task],
      ["the quality of their work", scores.quality],
      ["clear communication", scores.communication],
      ["their initiative", scores.initiative],
    ] as [string, number | null][]
  )
    .filter(([, s]) => (s ?? 0) >= 75)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([t]) => t);

  const strengthLine = strengths.length
    ? `${firstName} stood out for ${strengths.length > 1 ? `${strengths.slice(0, -1).join("; ")}; and ${strengths.at(-1)}` : strengths[0]}.`
    : `${firstName} approached every assignment with commitment and a willingness to learn.`;

  return [
    `I am pleased to recommend ${fullName}, who completed an internship with SOMENTM as ${role} in our ${department} team from ${formatDate(startDate)} to ${formatDate(endDate)}.`,
    `During the internship, ${firstName} completed ${approvedTasks} reviewed assignment${approvedTasks === 1 ? "" : "s"}${grade ? ` and finished the programme with a final evaluation of ${grade}` : ""}. ${strengthLine}`,
    `[Add a specific example of ${firstName}'s work here: a project, a result, or feedback from the team.]`,
    `${firstName} would be a valuable addition to any team, and I recommend them without reservation. Please feel free to verify this letter using the code below.`,
  ].join("\n\n");
}
