import "server-only";

/**
 * Sender must be on a domain verified in Resend. `onboarding@resend.dev` (the
 * old value) is Resend's test sender: it only delivers to the Resend account
 * owner, so every intern's email was silently refused.
 */
const FROM = process.env.EMAIL_FROM ?? "SOMENTM HR <hr@somentm.com>";
const REPLY_TO = process.env.EMAIL_REPLY_TO;

/**
 * Public base URL for links in emails. VERCEL_URL is the per-deployment URL
 * (often behind Vercel auth, and not a Clerk-allowed domain), so prefer an
 * explicit APP_URL, then the project's production domain.
 */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type OnboardingPerson = {
  first_name: string;
  email: string;
  employee_id: string;
  person_type: string;
  employment_type: string | null;
  department: string;
  role: string;
  cohort?: string | null;
};

/** Send the onboarding invite. Returns an error message instead of throwing. */
export async function sendOnboardingEmail(person: OnboardingPerson, token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY isn't set in this environment." };

  const isFounder = person.employment_type === "Founder";
  const isIntern = person.person_type === "Intern";
  const subject = isFounder
    ? "Welcome to SOMENTM HR — your founder account is ready"
    : isIntern
      ? "Welcome to SOMENTM — complete your internship onboarding"
      : "Welcome to SOMENTM — complete your onboarding";
  const roleDescription = isFounder ? `Founder & ${person.role}` : isIntern ? `${person.role} (Internship Program)` : person.role;
  const url = new URL(`/onboarding/${token}`, appUrl()).toString();

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#090a0c;color:#ffffff;border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
    <div style="border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:16px;margin-bottom:24px;">
      <div style="font-size:14px;font-weight:700;letter-spacing:4px;">SOMENTM</div>
      <div style="color:#8b929d;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-top:4px;">HR &amp; People Operations</div>
    </div>
    <h2 style="font-size:26px;font-weight:500;letter-spacing:-0.5px;margin:0 0 16px;">Welcome, ${esc(person.first_name)}.<span style="color:#8b929d;"> Let's get you set up.</span></h2>
    <p style="font-size:14px;line-height:1.6;color:#c7cbd1;margin:0 0 24px;">
      You've been added to the SOMENTM HR Portal as <strong style="color:#fff;">${esc(roleDescription)}</strong> in the <strong style="color:#fff;">${esc(person.department)}</strong> team. Complete your onboarding to activate your account.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;border-top:1px solid rgba(255,255,255,0.1);border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:28px;">
      <tr><td style="color:#8b929d;padding:10px 0;">SOMENTM ID</td><td style="font-family:monospace;text-align:right;">${esc(person.employee_id)}</td></tr>
      <tr><td style="color:#8b929d;padding:10px 0;">Department</td><td style="text-align:right;">${esc(person.department)}</td></tr>
      ${isIntern && person.cohort ? `<tr><td style="color:#8b929d;padding:10px 0;">Cohort</td><td style="text-align:right;">${esc(person.cohort)}</td></tr>` : ""}
    </table>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${esc(url)}" style="background:#ffffff;color:#090a0c;padding:14px 30px;text-decoration:none;font-weight:600;font-size:14px;border-radius:999px;display:inline-block;">Complete your onboarding →</a>
    </div>
    <p style="font-size:12px;color:#8b929d;text-align:center;margin:0 0 6px;">This secure link is single-use and expires in 7 days.</p>
    <p style="font-size:11px;color:#5b616b;text-align:center;margin:0 0 24px;word-break:break-all;">${esc(url)}</p>
    <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;font-size:11px;color:#5b616b;line-height:1.5;">
      SOMENTM HR · This is an automated message.
    </div>
  </div>`;

  const text = `Welcome to SOMENTM, ${person.first_name}.\n\nComplete your onboarding: ${url}\n\nSOMENTM ID: ${person.employee_id}\nThis link is single-use and expires in 7 days.`;

  try {
    const { Resend } = await import("resend");
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to: person.email,
      subject,
      html,
      text,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    });
    if (error) {
      console.error("Resend API error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("Resend request error:", err);
    return { ok: false, error: (err as Error).message };
  }
}
