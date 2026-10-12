import { UserPlus } from "lucide-react";
import { PageHeader, SectionHead } from "@/components/ui";
import Link from "next/link";
import { logAction, requireAdmin } from "@/lib/auth";
import { allowEmail } from "@/lib/clerk-allowlist";
import { sendOnboardingEmail } from "@/lib/email";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  async function addPerson(formData: FormData) {
    "use server";
    const { person: actor } = await requireAdmin();
    const adminSupabase = createAdminClient();

    const first_name = formData.get("first_name") as string;
    const last_name = formData.get("last_name") as string;
    const email = (formData.get("email") as string).trim().toLowerCase();
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

    await allowEmail(email);
    await logAction(actor.id, "person.created", "person", insertedPerson.id, { email, person_type: dbPersonType });

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

    const sent = await sendOnboardingEmail(
      { first_name, email, employee_id, person_type: dbPersonType, employment_type: dbEmploymentType, department, role, cohort },
      rawToken,
    );
    await logAction(actor.id, sent.ok ? "email.onboarding_sent" : "email.onboarding_failed", "person", insertedPerson.id, sent.ok ? undefined : { error: sent.error });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/people");
    revalidatePath("/");
    // land on the new profile so HR sees whether the invite went out
    redirect(`/people/${insertedPerson.id}?email=${sent.ok ? "sent" : "failed"}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        back={{ href: "/people", label: "People" }}
        eyebrow="New person"
        title="Add someone"
        dim="to the team."
        description="They get a SOMENTM ID and a secure, single-use onboarding link by email."
      />

      {error === "email-exists" && (
        <p role="alert" className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-text">
          <span className="live-dot danger" /> That email is already registered. Use a different one or find them in People.
        </p>
      )}
      {error === "insert-failed" && (
        <p role="alert" className="flex items-center gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-text">
          <span className="live-dot danger" /> Couldn&apos;t save this person. Please try again.
        </p>
      )}

      <form action={addPerson} className="space-y-12">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-3">
            <SectionHead index="01" title="Identity" />
            <p className="max-w-xs text-[13px] leading-relaxed text-muted">Name and the email their invite goes to.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:col-span-2">
            <div>
              <label className="label">First name</label>
              <input type="text" name="first_name" className="input" placeholder="e.g. Vinayak" required />
            </div>
            <div>
              <label className="label">Last name</label>
              <input type="text" name="last_name" className="input" placeholder="e.g. Sharma" required />
            </div>
            <div className="md:col-span-2">
              <label className="label">Email</label>
              <input type="email" name="email" className="input" placeholder="name@somentm.com" required />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
          <div className="space-y-3">
            <SectionHead index="02" title="Role" />
            <p className="max-w-xs text-[13px] leading-relaxed text-muted">How they&apos;re employed and where they sit.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:col-span-2">
            <div>
              <label className="label">Person type</label>
              <select name="person_type" className="input" required>
                <option value="Founder">Founder</option>
                <option value="Employee">Employee</option>
                <option value="Intern">Intern</option>
                <option value="Contractor">Contractor</option>
              </select>
            </div>
            <div>
              <label className="label">Employment type</label>
              <select name="employment_type" className="input">
                <option value="Founder">Founder</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contractor">Contractor</option>
              </select>
            </div>
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
              <label className="label">Role title</label>
              <input type="text" name="role" className="input" placeholder="e.g. Chief Executive Officer" required />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
          <div className="space-y-3">
            <SectionHead index="03" title="Internship" />
            <p className="max-w-xs text-[13px] leading-relaxed text-muted">Only for interns — leave blank otherwise.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:col-span-2">
            <div>
              <label className="label">Cohort</label>
              <input type="text" name="cohort" className="input" placeholder="e.g. Summer 2026" />
            </div>
            <div>
              <label className="label">Start date</label>
              <input type="date" name="start_date" className="input" />
            </div>
            <div>
              <label className="label">End date</label>
              <input type="date" name="end_date" className="input" />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-border pt-8">
          <Link href="/people" className="btn-ghost">Cancel</Link>
          <button type="submit" className="btn-primary">
            <UserPlus size={16} /> Save & send invite
          </button>
        </div>
      </form>
    </div>
  );
}
