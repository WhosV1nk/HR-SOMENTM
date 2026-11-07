"use server";

import { randomUUID } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { fileFrom, storeApplicationResume } from "@/lib/files";
import { notify } from "@/lib/notify";

export type ApplicationResponse =
  | {
      ok: true;
      application_no: string;
      candidate_name: string;
      opening_title: string;
      email: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function submitApplication(formData: FormData): Promise<ApplicationResponse> {
  try {
    const opening_id = (formData.get("opening_id") as string)?.trim();
    if (!opening_id) throw new Error("Invalid opening specified.");

    const first_name = (formData.get("first_name") as string)?.trim();
    const last_name = (formData.get("last_name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const phone = (formData.get("phone") as string)?.trim();

    if (!first_name || !last_name) throw new Error("Please provide your full name.");
    if (!email || !email.includes("@")) throw new Error("Please enter a valid email address.");
    if (!phone) throw new Error("Please provide your phone number.");

    const university = (formData.get("university") as string)?.trim() || null;
    const degree = (formData.get("degree") as string)?.trim() || null;
    const graduation_year = (formData.get("graduation_year") as string)?.trim() || null;
    const gpa = (formData.get("gpa") as string)?.trim() || null;

    const linkedin_url = (formData.get("linkedin_url") as string)?.trim() || null;
    const github_url = (formData.get("github_url") as string)?.trim() || null;
    const portfolio_url = (formData.get("portfolio_url") as string)?.trim() || null;
    const cover_note = (formData.get("cover_note") as string)?.trim() || null;

    const resumeFile = fileFrom(formData, "resume");
    if (!resumeFile) {
      throw new Error("Please upload your CV or Resume.");
    }

    const admin = createAdminClient();

    // Verify opening exists and is active
    const { data: opening, error: openingError } = await admin
      .from("internship_openings")
      .select("id, title, cohort, status")
      .eq("id", opening_id)
      .maybeSingle();

    if (openingError || !opening || opening.status !== "Active") {
      throw new Error("This internship opening is currently closed or not accepting applications.");
    }

    const applicationId = randomUUID();
    const application_no = `SOM-APP-${Math.floor(1000 + Math.random() * 9000)}`;

    // Upload resume to Supabase storage
    const uploadResult = await storeApplicationResume(applicationId, resumeFile);

    // Insert application record
    const { error: insertError } = await admin.from("internship_applications").insert({
      id: applicationId,
      opening_id: opening.id,
      application_no,
      first_name,
      last_name,
      email,
      phone,
      university,
      degree,
      graduation_year,
      gpa,
      linkedin_url,
      github_url,
      portfolio_url,
      cover_note,
      resume_file_path: uploadResult.path,
      resume_file_name: uploadResult.name,
      resume_file_size: uploadResult.size,
      resume_mime_type: uploadResult.type,
      status: "New",
    });

    if (insertError) {
      console.error("Failed to insert internship application:", insertError);
      throw new Error("Unable to save your application. Please try again.");
    }

    // Send in-app notification to HR
    await notify(
      null,
      `New Application: ${opening.title}`,
      `${first_name} ${last_name} (${email}) applied for ${opening.title} · Ref: ${application_no}`,
      "info"
    );

    return {
      ok: true,
      application_no,
      candidate_name: `${first_name} ${last_name}`,
      opening_title: opening.title,
      email,
    };
  } catch (err) {
    console.error("submitApplication error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong while submitting your application.",
    };
  }
}
