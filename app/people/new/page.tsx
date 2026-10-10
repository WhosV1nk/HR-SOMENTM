import { UserPlus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function addPerson(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const adminSupabase = createAdminClient();

    const first_name = formData.get("first_name") as string;
    const last_name = formData.get("last_name") as string;
    const email = formData.get("email") as string;
    const person_type = formData.get("person_type") as string;
    const employment_type = formData.get("employment_type") as string;
    const department = formData.get("department") as string;
    const role = formData.get("role") as string;
    const cohort = formData.get("cohort") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;

    // Generate SOMENTM ID
    const isFounder = person_type === "Founder" || employment_type === "Founder";
    const isInternType = person_type === "Intern";
    const prefix = isInternType ? "SOM-INT-" : "SOM-EMP-";
    const randNum = Math.floor(100 + Math.random() * 900);
    const employee_id = `${prefix}${randNum}`;

    // Map "Founder" to DB-safe person_type (CHECK only allows Employee, Intern, Contractor)
    const dbPersonType = person_type === "Founder" ? "Employee" : person_type;
    const dbEmploymentType = person_type === "Founder" ? "Founder" : (person_type === "Intern" ? "Intern" : employment_type);

    // Generate Cryptographically Secure Onboarding Token (Expires in 7 Days)
    const crypto = await import("crypto");
    const rawToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: insertedPerson, error: personInsertError } = await adminSupabase
      .from("people")
      .insert({
        employee_id,
        first_name,
        last_name,
        email,
        person_type: dbPersonType,
        employment_type: dbEmploymentType,
        department,
        role,
        status: isFounder ? "Active" : "Onboarding",
        onboarding_progress: 25,
        cohort: person_type === "Intern" ? cohort : null,
        start_date: person_type === "Intern" ? start_date : null,
        end_date: person_type === "Intern" ? end_date : null,
      })
      .select("id")
      .single();

    if (personInsertError || !insertedPerson?.id) {
      console.error("Failed to create person:", personInsertError);
      if (personInsertError?.code === "23505" && personInsertError.message?.includes("people_email_key")) {
        redirect("/people/new?error=email-exists");
      }
      redirect("/people/new?error=insert-failed");
    }

    const { error: tokenInsertError } = await adminSupabase.from("onboarding_tokens").insert({
        person_id: insertedPerson.id,
        token: rawToken,
        expires_at: expiresAt,
        used: false,
      });

    if (tokenInsertError) {
      console.error("Failed to create onboarding token:", tokenInsertError);
      throw new Error("Unable to create onboarding token.");
    }

    // Dynamic Branded Email Notification via Resend with Secure Token Link
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);

        const isFounder = person_type === "Founder" || employment_type === "Founder";
        const isIntern = person_type === "Intern";
        const isContractor = person_type === "Contractor";

        const titleType = isFounder ? "Founder" : isIntern ? "Intern" : isContractor ? "Contractor" : "Employee";
        const subject = isFounder
          ? `Welcome to SOMENTM HR — Your Founder Account Has Been Created`
          : isIntern
          ? `Welcome to SOMENTM — Internship Registration Confirmed`
          : `Welcome to SOMENTM — Complete Your ${titleType} Onboarding`;

        const roleDescription = isFounder
          ? `Founder & ${role}`
          : isIntern
          ? `${role} (Internship Program)`
          : role;

        const appUrl = process.env.APP_URL ?? (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");
        const onboardingUrl = new URL(`/onboarding/${rawToken}`, appUrl).toString();

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #090a0c; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; margin-bottom: 24px;">
              <h1 style="color: #ff3b3b; font-size: 20px; font-weight: 800; letter-spacing: 2px; margin: 0;">SOMENTM</h1>
              <div style="color: #888888; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">HR & People Operations</div>
            </div>

            <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #ffffff;">Welcome to SOMENTM, ${first_name}!</h2>
            
            <p style="font-size: 14px; line-height: 1.6; color: #cccccc; margin-bottom: 24px;">
              You have been registered in the SOMENTM HR Portal as a <strong>${roleDescription}</strong> in the <strong>${department}</strong> team. Please complete your onboarding steps.
            </p>

            <div style="background: rgba(255,255,255,0.04); border-left: 4px solid #ff3b3b; padding: 16px 20px; border-radius: 8px; margin-bottom: 28px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="color: #888888; padding: 6px 0;">SOMENTM ID:</td>
                  <td style="font-family: monospace; font-weight: 700; color: #ffffff; text-align: right;">${employee_id}</td>
                </tr>
                <tr>
                  <td style="color: #888888; padding: 6px 0;">Department:</td>
                  <td style="color: #ffffff; text-align: right;">${department}</td>
                </tr>
                ${isIntern && cohort ? `
                <tr>
                  <td style="color: #888888; padding: 6px 0;">Cohort:</td>
                  <td style="color: #ffffff; text-align: right;">${cohort}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${onboardingUrl}" style="background-color: #ff3b3b; color: #ffffff; padding: 14px 32px; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 10px; display: inline-block;">
                COMPLETE YOUR ONBOARDING →
              </a>
            </div>

            <p style="font-size: 11px; color: #666666; text-align: center; margin-bottom: 24px;">
              This secure onboarding link is single-use and expires in 7 days.
            </p>

            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; font-size: 11px; color: #666666; line-height: 1.5;">
              <p style="margin: 0;"><strong>SOMENTM HR</strong></p>
              <p style="margin: 2px 0 12px 0;">Vehicle Operations & Emergency Coordination Infrastructure</p>
              <p style="margin: 0; color: #444444;">This is an automated operational email. Please do not reply directly.</p>
            </div>
          </div>
        `;

        const { error: emailError } = await resend.emails.send({
          from: "onboarding@resend.dev",
          to: email,
          subject,
          html: emailHtml,
        }).catch(err => {
          console.error("Resend request error:", err);
          return { error: err };
        });

        if (emailError) {
          console.error("Resend API error:", emailError);
        }
    } else {
      console.error("RESEND_API_KEY is not configured; onboarding email was not sent.");
    }

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/people");
    revalidatePath("/");
    redirect("/people");
  }

  return (
    <div className="p-8 pb-20 max-w-3xl mx-auto">
      <div className="mb-8">
        <Link href="/people" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white mb-4 transition-colors">
          <ArrowLeft size={16} /> Back to People Directory
        </Link>
        <h1 className="page-title text-white">Add New Person</h1>
        <p className="mt-2 text-muted">Register a new employee, intern, or contractor to the SOMENTM team.</p>
      </div>

      <div className="card p-6">
        {error === "email-exists" && (
          <p role="alert" className="mb-5 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            This email address already exists. Use a different email or check the People directory.
          </p>
        )}
        <form action={addPerson} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">First Name</label>
              <input type="text" name="first_name" className="input" placeholder="e.g. Vinayak" required />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input type="text" name="last_name" className="input" placeholder="e.g. Sharma" required />
            </div>
          </div>

          <div>
            <label className="label">Email Address</label>
            <input type="email" name="email" className="input" placeholder="vinayak@somentm.com" required />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">Person Type</label>
              <select name="person_type" className="input" required>
                <option value="Founder">Founder</option>
                <option value="Employee">Employee</option>
                <option value="Intern">Intern</option>
                <option value="Contractor">Contractor</option>
              </select>
            </div>
            <div>
              <label className="label">Employment Type</label>
              <select name="employment_type" className="input">
                <option value="Founder">Founder</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contractor">Contractor</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">Department</label>
              <select name="department" className="input" required>
                <option value="Product">Product</option>
                <option value="Engineering">Engineering</option>
                <option value="Social Media">Social Media</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
            <div>
              <label className="label">Role Title</label>
              <input type="text" name="role" className="input" placeholder="e.g. Chief Executive Officer" required />
            </div>
          </div>

          {/* Intern specifics optional fields */}
          <div className="border-t border-border/40 pt-4 space-y-4">
            <h3 className="eyebrow">Internship Details (If Intern)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Cohort</label>
                <input type="text" name="cohort" className="input" placeholder="e.g. Summer 2026" />
              </div>
              <div>
                <label className="label">Start Date</label>
                <input type="date" name="start_date" className="input" />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" name="end_date" className="input" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3">
            <Link href="/people" className="btn-ghost">Cancel</Link>
            <button type="submit" className="btn-primary flex items-center gap-2">
              <UserPlus size={16} /> Save & Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
