import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { 
  Shield, 
  CheckCircle2, 
  Circle, 
  User, 
  Phone, 
  FileText, 
  Check, 
  ArrowRight, 
  Lock,
  Upload,
  FileCheck
} from "lucide-react";

export default async function ExternalOnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Validate Token against DB
  const adminSupabase = createAdminClient();
  const { data: tokenRecord, error: tokenLookupError } = await adminSupabase
    .from("onboarding_tokens")
    .select("*, people(*)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (tokenLookupError) {
    console.error("Failed to validate onboarding token:", tokenLookupError);
  }

  if (tokenLookupError || !tokenRecord || tokenRecord.used) {
    const verificationFailed = Boolean(tokenLookupError);
    return (
      <div className="min-h-screen bg-[#090a0c] text-white flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center space-y-4 border-l-4 border-l-rose-500">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <Lock size={24} />
          </div>
          <h1 className="text-xl font-bold text-white">
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

  // Fetch existing submission draft if present
  const { data: submission } = await adminSupabase
    .from("onboarding_submissions")
    .select("*")
    .eq("person_id", person.id)
    .single();

  // Server Action: Submit Onboarding Step
  async function submitOnboardingForm(formData: FormData) {
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

    const identity_doc_name = formData.get("identity_doc_name") as string || "Government ID Proof";
    const student_id_file = formData.get("student_id_file") as File | null;
    let student_id_doc_name = student_id_file?.name || "";

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

    revalidatePath(`/onboarding/${token}`);
    revalidatePath(`/people/${person.id}`);
    revalidatePath("/people");
    revalidatePath("/");
  }

  return (
    <div className="min-h-screen bg-[#090a0c] text-white font-sans antialiased p-6 md:p-12">
      {/* Film grain and ambient background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "160px 160px"
        }}
      />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        
        {/* Brand Header */}
        <div className="flex justify-between items-center border-b border-border/40 pb-6">
          <div>
            <span className="text-xl font-extrabold tracking-widest text-red-500">SOMENTM</span>
            <div className="text-[10px] text-muted tracking-widest uppercase mt-0.5">HR & People Operations</div>
          </div>
          <span className="font-mono text-xs text-muted px-3 py-1 bg-surface-2 rounded-lg border border-border">
            {person.employee_id}
          </span>
        </div>

        {submission?.submitted ? (
          /* Submission Confirmation Screen */
          <div className="card p-10 text-center space-y-6 bg-surface/80 border-l-4 border-l-emerald-500">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Onboarding Submitted Successfully!</h1>
              <p className="text-sm text-muted mt-2 max-w-lg mx-auto">
                Thank you, <strong>{person.first_name}</strong>. Your personal details, emergency contacts, and document submissions have been received by SOMENTM HR.
              </p>
            </div>

            <div className="p-4 bg-surface-2 rounded-xl text-xs text-muted max-w-md mx-auto space-y-2 text-left">
              <div className="flex justify-between">
                <span>SOMENTM ID:</span>
                <strong className="text-white font-mono">{person.employee_id}</strong>
              </div>
              <div className="flex justify-between">
                <span>Role:</span>
                <strong className="text-white">{person.role} ({person.department})</strong>
              </div>
              <div className="flex justify-between">
                <span>Document Status:</span>
                <span className="text-amber-400 font-semibold">Pending HR Verification</span>
              </div>
              {submission.student_id_doc_name && (
                <div className="flex justify-between items-center pt-1 border-t border-border/30">
                  <span>Student ID (PDF):</span>
                  <span className="text-white font-mono text-[11px] truncate max-w-[180px]">
                    📄 {submission.student_id_doc_name}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted/60">
              You will receive an automated activation confirmation once HR reviews and approves your submission.
            </p>
          </div>
        ) : (
          /* Multi-step Onboarding Form */
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Welcome to SOMENTM, {person.first_name}!</h1>
              <p className="text-sm text-muted">Complete your HR onboarding details to activate your account.</p>
            </div>

            {/* Read-Only Position Details */}
            <div className="card p-5 bg-surface-2/60 border border-border/60">
              <div className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">Your Position Details</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted">SOMENTM ID</span>
                  <div className="font-mono font-bold text-white">{person.employee_id}</div>
                </div>
                <div>
                  <span className="text-muted">Department</span>
                  <div className="font-semibold text-white capitalize">{person.department}</div>
                </div>
                <div>
                  <span className="text-muted">Role</span>
                  <div className="font-semibold text-white">{person.role}</div>
                </div>
                <div>
                  <span className="text-muted">Type</span>
                  <div className="font-semibold text-white">{person.employment_type || person.person_type}</div>
                </div>
              </div>
            </div>

            {/* Form */}
            <form action={submitOnboardingForm} className="space-y-6">
              
              {/* Step 1: Personal Info */}
              <div className="card p-6 space-y-4">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-3">
                  <User size={16} className="text-red-400" /> 1. Personal & Contact Information
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Phone Number *</label>
                    <input type="text" name="phone" className="input" placeholder="+91 9876543210" required />
                  </div>
                  <div>
                    <label className="label">Date of Birth *</label>
                    <input type="date" name="dob" className="input" required />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Address Line *</label>
                    <input type="text" name="address" className="input" placeholder="Building / Street address" required />
                  </div>
                  <div>
                    <label className="label">City *</label>
                    <input type="text" name="city" className="input" placeholder="City" required />
                  </div>
                  <div>
                    <label className="label">State / Pincode *</label>
                    <input type="text" name="state" className="input" placeholder="State" required />
                  </div>
                </div>
              </div>

              {/* Step 2: Emergency Contact */}
              <div className="card p-6 space-y-4">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-3">
                  <Phone size={16} className="text-red-400" /> 2. Emergency Contact
                </h2>

                <div className="grid grid-cols-3 gap-4">
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
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-3">
                  <FileText size={16} className="text-red-400" /> 3. Document Verification & Agreement
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Identity Proof (Aadhaar / Passport / Govt ID) *</label>
                    <input type="text" name="identity_doc_name" className="input" placeholder="Document Ref / Aadhaar Number" required />
                  </div>
                  <div>
                    <label className="label flex items-center justify-between">
                      <span>Student ID Card (PDF Format) {person.person_type === "Intern" ? "*" : "(Optional)"}</span>
                      <span className="text-[10px] text-muted font-mono">.pdf only</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="file" 
                        name="student_id_file" 
                        accept="application/pdf"
                        required={person.person_type === "Intern"}
                        className="input text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-red-500/10 file:text-red-400 hover:file:bg-red-500/20 cursor-pointer" 
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-surface-2 rounded-xl border border-border/50 text-xs text-muted space-y-2">
                  <div className="font-semibold text-white">SOMENTM Employment Agreement & Policy Declaration</div>
                  <p>By submitting this form, I confirm that all information provided is accurate and truthful. I agree to abide by SOMENTM policies and confidentiality terms.</p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button type="submit" className="btn-primary py-3 px-8 flex items-center gap-2">
                  Submit Onboarding <ArrowRight size={16} />
                </button>
              </div>

            </form>
          </div>
        )}

      </div>
    </div>
  );
}
