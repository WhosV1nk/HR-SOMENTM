import { requireAdmin, logAction } from "@/lib/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { PageHeader, SectionHead, StatusBadge, Stat } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { 
  Link2, 
  Plus, 
  ExternalLink, 
  Users, 
  CheckCircle2, 
  Briefcase, 
  Globe, 
  Calendar,
  Lock,
  Unlock,
  Eye
} from "lucide-react";

export default async function InternshipPostingsPage() {
  const { person: actor } = await requireAdmin();
  const admin = createAdminClient();

  // Fetch all openings with their applicant counts
  const { data: openings } = await admin
    .from("internship_openings")
    .select("*, internship_applications(id, status)")
    .order("created_at", { ascending: false });

  // Calculate statistics
  const totalOpenings = openings?.length || 0;
  const activeOpenings = openings?.filter((o) => o.status === "Active").length || 0;
  const totalApplicants = openings?.reduce((acc, o) => acc + (o.internship_applications?.length || 0), 0) || 0;

  // Server Action: Create New Internship Opening
  async function createOpening(formData: FormData) {
    "use server";
    const { person: currentActor } = await requireAdmin();
    const supabase = createAdminClient();

    const title = (formData.get("title") as string)?.trim();
    const department = (formData.get("department") as string)?.trim();
    const cohort = (formData.get("cohort") as string)?.trim() || "Summer 2026";
    const duration = (formData.get("duration") as string)?.trim() || "3 Months";
    const location = (formData.get("location") as string)?.trim() || "Remote";
    const stipend = (formData.get("stipend") as string)?.trim() || "Paid";
    const rawSlug = (formData.get("slug") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const requirements = (formData.get("requirements") as string)?.trim() || null;
    const perks = (formData.get("perks") as string)?.trim() || null;

    if (!title || !department || !description) {
      throw new Error("Title, Department, and Description are required.");
    }

    // Generate clean slug
    const cleanSlug = (rawSlug || `${title}-${cohort}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const finalSlug = `${cleanSlug}-${Math.floor(100 + Math.random() * 900)}`;

    const { data: newOpening, error } = await supabase
      .from("internship_openings")
      .insert({
        title,
        department,
        cohort,
        duration,
        location,
        stipend,
        slug: finalSlug,
        description,
        requirements,
        perks,
        status: "Active",
        created_by: currentActor.id,
      })
      .select("id, slug, title")
      .single();

    if (error) {
      console.error("Failed to create opening:", error);
      throw new Error(`Failed to create opening: ${error.message}`);
    }

    await logAction(currentActor.id, "internship_opening.created", "internship_openings", newOpening.id, {
      title,
      slug: finalSlug,
    });

    revalidatePath("/interns/postings");
  }

  // Server Action: Toggle Opening Status
  async function toggleStatus(formData: FormData) {
    "use server";
    const { person: currentActor } = await requireAdmin();
    const supabase = createAdminClient();

    const openingId = formData.get("opening_id") as string;
    const currentStatus = formData.get("current_status") as string;
    const newStatus = currentStatus === "Active" ? "Closed" : "Active";

    await supabase
      .from("internship_openings")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", openingId);

    await logAction(currentActor.id, "internship_opening.status_updated", "internship_openings", openingId, {
      status: newStatus,
    });

    revalidatePath("/interns/postings");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        back={{ href: "/interns", label: "Interns" }}
        eyebrow="Recruitment & Links"
        title="Internship Openings,"
        dim="generate & share application links."
        description="Create custom openings for any department or cohort. Candidates get a branded application portal with CV/resume upload."
      >
        <Link href="/interns/applications" className="btn-secondary">
          <Users size={16} /> View all applications ({totalApplicants})
        </Link>
      </PageHeader>

      {/* Metric Strips */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-y border-border py-6">
        <Stat label="Total Openings" value={totalOpenings} hint="All-time created" />
        <Stat label="Active Links" value={activeOpenings} hint="Currently accepting applications" />
        <Stat label="Total Applications" value={totalApplicants} hint="Candidates applied" />
      </div>

      {/* Section 1: Generate Link & Opening Form */}
      <section className="space-y-6">
        <SectionHead
          index="01"
          title="Generate New Internship Link"
          description="Fill in the role details to create an instant public application link (/apply/[slug])."
        />

        <form action={createOpening} className="card p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="label">Role Title *</label>
              <input
                type="text"
                name="title"
                required
                placeholder="e.g. AI Engineering Intern / Product Design Intern"
                className="input"
              />
            </div>
            <div>
              <label className="label">Department *</label>
              <select name="department" required className="input">
                <option value="Engineering">Engineering</option>
                <option value="Product">Product</option>
                <option value="Social Media">Social Media</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
                <option value="Design">Design</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <label className="label">Cohort</label>
              <input
                type="text"
                name="cohort"
                defaultValue="Summer 2026"
                placeholder="e.g. Summer 2026"
                className="input"
              />
            </div>
            <div>
              <label className="label">Duration</label>
              <input
                type="text"
                name="duration"
                defaultValue="3 Months"
                placeholder="e.g. 3 Months / 6 Months"
                className="input"
              />
            </div>
            <div>
              <label className="label">Location</label>
              <input
                type="text"
                name="location"
                defaultValue="Remote"
                placeholder="Remote / Bangalore"
                className="input"
              />
            </div>
            <div>
              <label className="label">Stipend</label>
              <input
                type="text"
                name="stipend"
                defaultValue="Paid"
                placeholder="e.g. Paid / ₹25,000/mo"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Custom URL Slug (Optional)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-mono bg-surface-2 px-3 py-2.5 rounded-xl border border-border">
                /apply/
              </span>
              <input
                type="text"
                name="slug"
                placeholder="ai-engineer-summer-2026 (leave empty to auto-generate)"
                className="input font-mono text-xs flex-1"
              />
            </div>
            <p className="mt-1 text-[11px] text-faint">
              A random suffix is automatically attached to ensure the link is unique and tamper-proof.
            </p>
          </div>

          <div className="space-y-2">
            <label className="label">Role Description *</label>
            <textarea
              name="description"
              required
              rows={4}
              placeholder="Describe the responsibilities, what the intern will learn, and projects they will tackle..."
              className="input resize-none py-2 text-xs leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="label">Requirements & Skills (One per line)</label>
              <textarea
                name="requirements"
                rows={4}
                placeholder="Proficiency in Next.js, React, TypeScript&#10;Understanding of REST APIs and Supabase&#10;Strong problem solving and passion for building products"
                className="input resize-none py-2 text-xs leading-relaxed"
              />
            </div>
            <div className="space-y-2">
              <label className="label">Perks & Offerings (One per line)</label>
              <textarea
                name="perks"
                rows={4}
                placeholder="Hands-on mentorship from senior engineering team&#10;Verified completion certificate and LinkedIn endorsement&#10;High potential for Pre-Placement Offer (PPO)"
                className="input resize-none py-2 text-xs leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="submit" className="btn-primary">
              <Plus size={16} /> Generate Link & Publish Opening
            </button>
          </div>
        </form>
      </section>

      {/* Section 2: Active & Managed Openings */}
      <section className="space-y-6">
        <SectionHead
          index="02"
          title="Active & Published Links"
          description="Copy public links to share on LinkedIn, university career portals, or candidate emails."
        />

        {(!openings || openings.length === 0) ? (
          <div className="card p-12 text-center text-sm text-muted">
            No internship links generated yet. Use the form above to publish your first opening.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {openings.map((opening) => {
              const appCount = opening.internship_applications?.length || 0;
              const publicPath = `/apply/${opening.slug}`;

              return (
                <div key={opening.id} className="card p-6 md:p-8 space-y-6 border border-border">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="badge-brand text-xs">{opening.department}</span>
                        <StatusBadge
                          status={opening.status}
                          label={opening.status === "Active" ? "Accepting Applications" : "Closed"}
                        />
                        <span className="text-xs text-muted font-mono">
                          {opening.cohort || "Active"}
                        </span>
                      </div>
                      <h3 className="text-xl font-medium tracking-tight text-text">
                        {opening.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/interns/applications?opening_id=${opening.id}`}
                        className="btn-secondary text-xs flex items-center gap-1.5"
                      >
                        <Users size={14} />
                        <span>{appCount} {appCount === 1 ? "Applicant" : "Applicants"}</span>
                      </Link>

                      <form action={toggleStatus}>
                        <input type="hidden" name="opening_id" value={opening.id} />
                        <input type="hidden" name="current_status" value={opening.status} />
                        <button
                          type="submit"
                          className={`btn-ghost text-xs flex items-center gap-1.5 ${
                            opening.status === "Active" ? "text-danger hover:text-danger" : "text-ok hover:text-ok"
                          }`}
                        >
                          {opening.status === "Active" ? (
                            <>
                              <Lock size={14} /> Close Opening
                            </>
                          ) : (
                            <>
                              <Unlock size={14} /> Re-open Opening
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Shareable Link Box */}
                  <div className="card-2 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Globe size={13} />
                        <span className="font-mono">Public Shareable Link</span>
                      </div>
                      <p className="text-xs font-mono text-text truncate max-w-xl">
                        {publicPath}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <CopyButton
                        text={`${process.env.NEXT_PUBLIC_APP_URL || ""}${publicPath}`}
                        label="Copy link"
                        copiedLabel="Copied!"
                      />
                      <a
                        href={publicPath}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost text-xs flex items-center gap-1"
                      >
                        <Eye size={14} /> Preview
                      </a>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted">
                    <div>
                      <span className="label block">Location</span>
                      <span className="text-text">{opening.location || "Remote"}</span>
                    </div>
                    <div>
                      <span className="label block">Duration</span>
                      <span className="text-text">{opening.duration || "3 Months"}</span>
                    </div>
                    <div>
                      <span className="label block">Stipend</span>
                      <span className="text-text">{opening.stipend || "Paid"}</span>
                    </div>
                    <div>
                      <span className="label block">Created</span>
                      <span className="text-text">{new Date(opening.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
