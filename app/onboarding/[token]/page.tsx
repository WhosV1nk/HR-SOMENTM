import { attempt, type ActionResult } from "@/lib/action-result";
import { ActionForm } from "@/components/action-form";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { fileFrom, storeFile } from "@/lib/files";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/auth";
import { IrisBackdrop, Wordmark } from "@/components/wordmark";
import { CheckCircle2, ArrowRight, Lock } from "lucide-react";

export default async function ExternalOnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Validate Token against DB
  const adminSupabase = createAdminClient();
  const { data: tokenRecord, error: tokenLookupError } = await adminSupabase
    .from("onboarding_tokens")
    .select("*, people(*)")
    .eq("token", token)
    .maybeSingle();

  if (tokenLookupError) {
    console.error("Failed to validate onboarding token:", tokenLookupError);
  }

  const { data: submission } = tokenRecord?.people
    ? await adminSupabase.from("onboarding_submissions").select("*").eq("person_id", tokenRecord.people.id).maybeSingle()
    : { data: null };

  // a used link still shows the "all set" screen to the person who completed it
  const finished = Boolean(tokenRecord?.used && submission?.submitted);
  // server component, rendered per request — reading the clock here is intended
  // eslint-disable-next-line react-hooks/purity
  const expired = !tokenRecord || Date.parse(tokenRecord.expires_at) < Date.now();

  if (tokenLookupError || !tokenRecord?.people || (!finished && (expired || tokenRecord.used))) {
    const verificationFailed = Boolean(tokenLookupError);
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-6">
        <IrisBackdrop />
        <div className="card relative z-10 w-full max-w-md space-y-4 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-danger/30 bg-danger-soft text-brand-2">
            <Lock size={24} />
          </div>
          <h1 className="display text-2xl">
            {verificationFailed ? "Unable to Verify Invitation" : "Onboarding Link Expired"}
          </h1>
          <p className="text-xs text-muted">
            {verificationFailed
              ? "We could not verify this link right now. Please contact your SOMENTM HR Administrator."
              : "This secure onboarding link has expired or has already been used. Please contact your SOMENTM HR Administrator for a new invitation."}
          </p>
        </div>
      </div>
    );
  }

  const person = tokenRecord.people;

  // Server Action: Submit Onboarding Step
  async function submitOnboardingForm(_prev: ActionResult, formData: FormData) {
    "use server";
    return attempt(() => submitOnboardingFormImpl(formData));
  }

  async function submitOnboardingFormImpl(formData: FormData) {
    "use server";
    const supabase = createAdminClient();
    const { data: activeToken, error: activeTokenError } = await supabase
      .from("onboarding_tokens")
      .select("person_id")
      .eq("token", token)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (activeTokenError || activeToken?.person_id !== person.id) {
      console.error("Onboarding token is invalid or unavailable:", activeTokenError);
      throw new Error("This onboarding link is no longer valid.");
    }

    const phone = formData.get("phone") as string;
    const dob = formData.get("dob") as string;
    const gender = formData.get("gender") as string;
    const address = formData.get("address") as string;
    const city = formData.get("city") as string;
    const state = formData.get("state") as string;
    const pincode = formData.get("pincode") as string;

    const emergency_name = formData.get("emergency_name") as string;
    const emergency_relationship = formData.get("emergency_relationship") as string;
    const emergency_phone = formData.get("emergency_phone") as string;

    if (formData.get("agree") !== "on") throw new Error("Please accept the agreement to continue.");
    const identity_doc_name = (formData.get("identity_doc_name") as string) || "Government ID";
    const identityFile = fileFrom(formData, "identity_file");
    const studentIdFile = fileFrom(formData, "student_id_file");
    if (!identityFile) throw new Error("Please upload your identity proof.");
    if (person.person_type === "Intern" && !studentIdFile) throw new Error("Please upload your student ID card.");

    // files go to private storage as Pending — uploading never verifies them
    const uploads = [
      { kind: "identity", title: identity_doc_name, file: identityFile },
      ...(studentIdFile ? [{ kind: "student_id", title: "Student ID card", file: studentIdFile }] : []),
    ];
    for (const u of uploads) {
      const stored = await storeFile(person.id, u.file, "onboarding");
      const { error: docError } = await supabase.from("documents").insert({
        person_id: person.id,
        kind: u.kind,
        title: u.title,
        file_path: stored.path,
        file_name: stored.name,
        mime_type: stored.type,
        size_bytes: stored.size,
        status: "Pending",
        uploaded_by: person.id,
      });
      if (docError) throw new Error("Unable to save your documents. Please try again.");
    }
    const student_id_doc_name = studentIdFile?.name ?? "";

    // Update or Insert Onboarding Submission
    const { error: submissionError } = await supabase.from("onboarding_submissions").upsert({
      person_id: person.id,
      phone,
      dob,
      gender,
      address,
      city,
      state,
      pincode,
      emergency_name,
      emergency_relationship,
      emergency_phone,
      identity_doc_name,
      identity_doc_status: "Pending",
      student_id_doc_name: student_id_doc_name || null,
      agreement_signed: true,
      submitted: true,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "person_id" });

    if (submissionError) {
      console.error("Failed to save onboarding submission:", submissionError);
      throw new Error("Unable to save onboarding submission.");
    }

    // Update person record details
    const { error: personUpdateError } = await supabase.from("people").update({
      phone,
      dob,
      address: `${address}, ${city}, ${state} ${pincode}`,
      emergency_contact: `${emergency_name} (${emergency_relationship}) - ${emergency_phone}`,
      onboarding_progress: 75
    }).eq("id", person.id);

    if (personUpdateError) {
      console.error("Failed to update onboarding person:", personUpdateError);
      throw new Error("Unable to update onboarding person.");
    }

    // Invalidate token so link is single-use
    const { error: tokenUpdateError } = await supabase
      .from("onboarding_tokens")
      .update({ used: true })
      .eq("token", token);

    if (tokenUpdateError) {
      console.error("Failed to mark onboarding token as used:", tokenUpdateError);
      throw new Error("Unable to complete onboarding.");
    }

    await notify(null, "Onboarding submitted", `${person.first_name} ${person.last_name} · documents waiting for verification`, "onboarding");
    await logAction(person.id, "onboarding.submitted", "person", person.id);

    revalidatePath(`/onboarding/${token}`);
    revalidatePath(`/people/${person.id}`);
    revalidatePath("/people");
    revalidatePath("/");
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden px-6 py-10 md:px-12">
      {/* Film grain and ambient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "160px 160px"
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl space-y-12">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-border pb-6">
          <Wordmark sub="People Operations" href="#" />
          <span className="font-mono text-xs text-muted">
            {person.employee_id}
          </span>
        </div>

        {submission?.submitted ? (
          /* Submission Confirmation Screen */
          <div className="card space-y-6 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-ok/30 bg-ok-soft text-ok">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h1 className="display text-4xl">You&apos;re all set.<span className="headline-dim"> HR takes it from here.</span></h1>
              <p className="text-sm text-muted mt-2 max-w-lg mx-auto">
                Thank you, <strong>{person.first_name}</strong>. Your personal details, emergency contacts, and document submissions have been received by SOMENTM HR.
              </p>
            </div>

            <div className="card-2 mx-auto max-w-md space-y-2 p-4 text-left text-xs text-muted">
              <div className="flex justify-between">
                <span>SOMENTM ID:</span>
                <strong className="text-text font-mono">{person.employee_id}</strong>
              </div>
              <div className="flex justify-between">
                <span>Role:</span>
                <strong className="text-text">{person.role} ({person.department})</strong>
              </div>
              <div className="flex justify-between">
                <span>Document Status:</span>
                <span className="badge-warn">Pending HR Verification</span>
              </div>
              {submission?.student_id_doc_name && (
                <div className="flex justify-between items-center pt-1 border-t border-border/30">
                  <span>Student ID (PDF):</span>
                  <span className="text-text font-mono text-[11px] truncate max-w-[180px]">
                    {submission?.student_id_doc_name}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-[13px] text-muted">
                Your portal is ready. Sign in with <b className="font-medium text-text">{person.email}</b> to see your tasks, attendance and documents.
              </p>
              <Link href="/sign-in" className="btn-primary">Sign in to your portal <ArrowRight size={16} /></Link>
            </div>
          </div>
        ) : (
          /* Multi-step Onboarding Form */
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="eyebrow">Onboarding</div>
              <h1 className="display text-4xl md:text-5xl">Welcome, {person.first_name}.<span className="headline-dim"> Let&apos;s get you set up.</span></h1>
              <p className="text-[15px] text-muted">Three short sections. It takes about five minutes.</p>
            </div>

            {/* Read-Only Position Details */}
            <div className="border-y border-border py-5">
              <div className="label mb-3">Your position</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted">SOMENTM ID</span>
                  <div className="font-mono font-bold text-text">{person.employee_id}</div>
                </div>
                <div>
                  <span className="text-muted">Department</span>
                  <div className="font-semibold text-text capitalize">{person.department}</div>
                </div>
                <div>
                  <span className="text-muted">Role</span>
                  <div className="font-semibold text-text">{person.role}</div>
                </div>
                <div>
                  <span className="text-muted">Type</span>
                  <div className="font-semibold text-text">{person.employment_type || person.person_type}</div>
                </div>
              </div>
            </div>

            {/* Form */}
            <ActionForm action={submitOnboardingForm} className="space-y-6">
              
              {/* Step 1: Personal Info */}
              <div className="card p-6 space-y-4">
                <h2 className="flex items-baseline gap-3 border-b border-border pb-4 text-xl font-medium tracking-tight">
                  <span className="index">01</span> Personal & Contact Information
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Phone Number *</label>
                    <input type="text" name="phone" className="input" placeholder="+91 9876543210" required />
                  </div>
                  <div>
                    <label className="label">Date of Birth *</label>
                    <input type="date" name="dob" className="input" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label className="label">Address Line *</label>
                    <input type="text" name="address" className="input" placeholder="Building / Street address" required />
                  </div>
                  <div>
                    <label className="label">City *</label>
                    <input type="text" name="city" className="input" placeholder="City" required />
                  </div>
                  <div>
                    <label className="label">State *</label>
                    <input type="text" name="state" className="input" placeholder="State" required />
                  </div>
                  <div>
                    <label className="label">Pincode *</label>
                    <input type="text" name="pincode" inputMode="numeric" pattern="[0-9]{6}" className="input" placeholder="560001" required />
                  </div>
                </div>
              </div>

              {/* Step 2: Emergency Contact */}
              <div className="card p-6 space-y-4">
                <h2 className="flex items-baseline gap-3 border-b border-border pb-4 text-xl font-medium tracking-tight">
                  <span className="index">02</span> Emergency Contact
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">Contact Name *</label>
                    <input type="text" name="emergency_name" className="input" placeholder="Emergency Contact Name" required />
                  </div>
                  <div>
                    <label className="label">Relationship *</label>
                    <input type="text" name="emergency_relationship" className="input" placeholder="e.g. Spouse / Parent" required />
                  </div>
                  <div>
                    <label className="label">Emergency Phone *</label>
                    <input type="text" name="emergency_phone" className="input" placeholder="+91 XXXXX XXXXX" required />
                  </div>
                </div>
              </div>

              {/* Step 3: Document Proof & Agreement */}
              <div className="card p-6 space-y-4">
                <h2 className="flex items-baseline gap-3 border-b border-border pb-4 text-xl font-medium tracking-tight">
                  <span className="index">03</span> Document Verification & Agreement
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label">Identity proof *</label>
                    <select name="identity_doc_name" className="input" required>
                      <option>Aadhaar card</option>
                      <option>Passport</option>
                      <option>PAN card</option>
                      <option>Driving licence</option>
                      <option>Voter ID</option>
                    </select>
                    <input
                      type="file"
                      name="identity_file"
                      accept="application/pdf,image/*"
                      required
                      aria-label="Identity proof file"
                      className="input text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white file:text-black hover:file:bg-white/90 cursor-pointer"
                    />
                    <p className="text-[11px] text-faint">PDF or photo, max 4 MB. For Aadhaar, you may mask the first 8 digits.</p>
                  </div>
                  <div>
                    <label className="label flex items-center justify-between">
                      <span>Student ID Card (PDF Format) {person.person_type === "Intern" ? "*" : "(Optional)"}</span>
                      <span className="text-[10px] text-muted font-mono">PDF / image</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="file" 
                        name="student_id_file" 
                        accept="application/pdf,image/*"
                        required={person.person_type === "Intern"}
                        className="input text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white file:text-black hover:file:bg-white/90 cursor-pointer" 
                      />
                    </div>
                  </div>
                </div>

                <div className="card-2 space-y-2 p-4 text-xs leading-relaxed text-muted">
                  <div className="font-medium text-text">SOMENTM Employment Agreement & Policy Declaration</div>
                  <p>By submitting this form, I confirm that all information provided is accurate and truthful. I agree to abide by SOMENTM policies and confidentiality terms.</p>
                  <label className="flex items-center gap-2.5 pt-1 text-[13px] text-text">
                    <input type="checkbox" name="agree" required className="h-4 w-4" /> I have read and agree to the above.
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button type="submit" className="btn-primary px-8 py-3">
                  Submit Onboarding <ArrowRight size={16} />
                </button>
              </div>

            </ActionForm>
          </div>
        )}

      </div>
    </div>
  );
}
