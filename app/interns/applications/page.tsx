import { requireAdmin, logAction } from "@/lib/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { PageHeader, SectionHead, StatusBadge, Stat, Avatar } from "@/components/ui";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { 
  FileText, 
  ExternalLink, 
  UserCheck, 
  Mail, 
  Phone, 
  GraduationCap, 
  Globe, 
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Link2
} from "lucide-react";

export default async function InternshipApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ opening_id?: string; status?: string }>;
}) {
  const { person: actor } = await requireAdmin();
  const admin = createAdminClient();
  const params = await searchParams;
  const { opening_id: filterOpeningId, status: filterStatus } = params;

  // Fetch openings for the filter dropdown
  const { data: openings } = await admin
    .from("internship_openings")
    .select("id, title, cohort, department")
    .order("title");

  // Query applications with opening relation
  let query = admin
    .from("internship_applications")
    .select("*, internship_openings(id, title, department, cohort, duration)")
    .order("created_at", { ascending: false });

  if (filterOpeningId) {
    query = query.eq("opening_id", filterOpeningId);
  }
  if (filterStatus && filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }

  const { data: applications } = await query;

  // Status counts for filtering pills
  const { data: allApplications } = await admin
    .from("internship_applications")
    .select("status");

  const totalCount = allApplications?.length || 0;
  const newCount = allApplications?.filter((a) => a.status === "New").length || 0;
  const shortlistedCount = allApplications?.filter((a) => a.status === "Shortlisted").length || 0;
  const interviewedCount = allApplications?.filter((a) => a.status === "Interviewed").length || 0;
  const offeredCount = allApplications?.filter((a) => a.status === "Offered").length || 0;
  const hiredCount = allApplications?.filter((a) => a.status === "Hired").length || 0;

  // Server Action: Update Application Status & Notes
  async function updateApplication(formData: FormData) {
    "use server";
    const { person: currentActor } = await requireAdmin();
    const supabase = createAdminClient();

    const applicationId = formData.get("application_id") as string;
    const newStatus = formData.get("status") as string;
    const reviewerNotes = (formData.get("reviewer_notes") as string)?.trim() || null;

    await supabase
      .from("internship_applications")
      .update({
        status: newStatus,
        reviewer_notes: reviewerNotes,
        reviewed_by: currentActor.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    await logAction(currentActor.id, "internship_application.updated", "internship_applications", applicationId, {
      status: newStatus,
      reviewer_notes: reviewerNotes,
    });

    revalidatePath("/interns/applications");
  }

  function formatBytes(bytes?: number | null) {
    if (!bytes) return "Resume";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  const STATUS_OPTIONS = [
    "New",
    "Reviewing",
    "Shortlisted",
    "Interviewed",
    "Offered",
    "Rejected",
    "Hired",
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        back={{ href: "/interns", label: "Interns" }}
        eyebrow="Recruitment & Pipeline"
        title="Candidate Applications,"
        dim="review CVs & convert to onboarding."
        description="Inspect received applications, download candidate CVs, update recruitment stages, and directly convert candidates to official onboarding."
      >
        <Link href="/interns/postings" className="btn-secondary">
          <Link2 size={16} /> Manage Openings & Links
        </Link>
      </PageHeader>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-y border-border py-6">
        <Stat label="Total Received" value={totalCount} hint="All applications" />
        <Stat label="New Submissions" value={newCount} hint="Awaiting review" />
        <Stat label="Shortlisted" value={shortlistedCount} hint="In consideration" />
        <Stat label="Hired / Converted" value={hiredCount} hint="Moved to team" />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "All", value: "all", count: totalCount },
            { label: "New", value: "New", count: newCount },
            { label: "Shortlisted", value: "Shortlisted", count: shortlistedCount },
            { label: "Interviewed", value: "Interviewed", count: interviewedCount },
            { label: "Offered", value: "Offered", count: offeredCount },
            { label: "Hired", value: "Hired", count: hiredCount },
          ].map((pill) => {
            const isActive = (filterStatus || "all") === pill.value;
            const href = `?${new URLSearchParams({
              ...(filterOpeningId ? { opening_id: filterOpeningId } : {}),
              status: pill.value,
            }).toString()}`;

            return (
              <Link
                key={pill.value}
                href={href}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  isActive
                    ? "border-text bg-text text-background font-medium"
                    : "border-border text-muted hover:text-text hover:border-text/40"
                }`}
              >
                {pill.label} ({pill.count})
              </Link>
            );
          })}
        </div>

        {/* Opening Filter Dropdown */}
        <form method="GET" className="flex items-center gap-2">
          {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
          <Filter size={14} className="text-muted shrink-0" />
          <select
            name="opening_id"
            defaultValue={filterOpeningId || ""}
            className="input text-xs py-1.5"
            // Submit on change
            aria-label="Filter by Opening"
          >
            <option value="">All Openings</option>
            {openings?.map((op) => (
              <option key={op.id} value={op.id}>
                {op.title} ({op.cohort || "Active"})
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary text-xs py-1.5">
            Filter
          </button>
        </form>
      </div>

      {/* Applications List */}
      <section className="space-y-6">
        <SectionHead
          index="01"
          title={`Applications (${applications?.length || 0})`}
          description="Click candidate CV to review, change statuses, or convert directly to onboarding."
        />

        {(!applications || applications.length === 0) ? (
          <div className="card p-12 text-center text-sm text-muted">
            No applications match the selected criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {applications.map((app) => {
              const opening = app.internship_openings;
              const hasLinks = app.linkedin_url || app.github_url || app.portfolio_url;
              const convertUrl = `/people/new?first_name=${encodeURIComponent(
                app.first_name
              )}&last_name=${encodeURIComponent(app.last_name)}&email=${encodeURIComponent(
                app.email
              )}&department=${encodeURIComponent(
                opening?.department || "Engineering"
              )}&role=${encodeURIComponent(
                opening?.title || "Intern"
              )}&cohort=${encodeURIComponent(opening?.cohort || "")}&person_type=Intern`;

              return (
                <div key={app.id} className="card p-6 md:p-8 space-y-6 border border-border">
                  {/* Top Bar: Candidate & Position */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-5">
                    <div className="flex items-start gap-4">
                      <Avatar first={app.first_name} last={app.last_name} size="md" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-medium text-text">
                            {app.first_name} {app.last_name}
                          </h3>
                          <span className="font-mono text-xs text-muted">
                            {app.application_no}
                          </span>
                          <StatusBadge status={app.status} />
                        </div>
                        <p className="text-xs text-muted">
                          Applied for{" "}
                          <strong className="text-text font-medium">{opening?.title || "Internship"}</strong>{" "}
                          ({opening?.cohort || "Active"} · {opening?.department || "General"}) ·{" "}
                          <span>{new Date(app.created_at).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions: CV Download & Convert to Onboarding */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {/* CV / Resume Download Button */}
                      <a
                        href={`/files/resume/${app.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary text-xs flex items-center gap-1.5"
                        title={app.resume_file_name}
                      >
                        <FileText size={14} className="text-brand" />
                        <span>Download CV ({formatBytes(app.resume_file_size)})</span>
                        <ExternalLink size={12} className="text-muted" />
                      </a>

                      {/* Convert to Intern */}
                      <Link
                        href={convertUrl}
                        className="btn-primary text-xs flex items-center gap-1.5"
                        title="Send onboarding invitation with pre-filled details"
                      >
                        <UserCheck size={14} />
                        <span>Convert to Onboarding</span>
                      </Link>
                    </div>
                  </div>

                  {/* Candidate Details & Education */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Contact Info */}
                    <div className="space-y-2">
                      <span className="label block">Contact Information</span>
                      <div className="space-y-1 text-xs">
                        <a
                          href={`mailto:${app.email}`}
                          className="flex items-center gap-2 text-text hover:underline truncate"
                        >
                          <Mail size={13} className="text-muted shrink-0" />
                          <span>{app.email}</span>
                        </a>
                        <a
                          href={`tel:${app.phone}`}
                          className="flex items-center gap-2 text-text hover:underline truncate"
                        >
                          <Phone size={13} className="text-muted shrink-0" />
                          <span>{app.phone}</span>
                        </a>
                      </div>
                    </div>

                    {/* Education */}
                    <div className="space-y-2">
                      <span className="label block">Academic Background</span>
                      <div className="text-xs space-y-0.5 text-muted">
                        <p className="text-text font-medium">{app.university || "University not specified"}</p>
                        <p>{app.degree || "Degree not specified"}</p>
                        <p className="font-mono text-[11px]">
                          Grad: {app.graduation_year || "N/A"}{app.gpa ? ` · GPA: ${app.gpa}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Profiles & Links */}
                    <div className="space-y-2">
                      <span className="label block">Online Presence</span>
                      {hasLinks ? (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {app.linkedin_url && (
                            <a
                              href={app.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              className="card-2 px-2.5 py-1 text-xs flex items-center gap-1.5 text-text hover:border-brand transition-colors"
                            >
                              <span className="font-semibold text-brand text-[10px]">in</span> LinkedIn
                            </a>
                          )}
                          {app.github_url && (
                            <a
                              href={app.github_url}
                              target="_blank"
                              rel="noreferrer"
                              className="card-2 px-2.5 py-1 text-xs flex items-center gap-1.5 text-text hover:border-brand transition-colors"
                            >
                              <Link2 size={13} className="text-muted" /> GitHub
                            </a>
                          )}
                          {app.portfolio_url && (
                            <a
                              href={app.portfolio_url}
                              target="_blank"
                              rel="noreferrer"
                              className="card-2 px-2.5 py-1 text-xs flex items-center gap-1.5 text-text hover:border-brand transition-colors"
                            >
                              <Globe size={13} className="text-muted" /> Portfolio
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">No external links provided</p>
                      )}
                    </div>
                  </div>

                  {/* Candidate Pitch / Cover Note */}
                  {app.cover_note && (
                    <div className="card-2 p-4 space-y-1.5 border border-border/50 text-xs">
                      <span className="text-[11px] uppercase tracking-wider text-muted font-medium">
                        Candidate Note / Pitch:
                      </span>
                      <p className="text-text leading-relaxed whitespace-pre-line italic">
                        &ldquo;{app.cover_note}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Reviewer Status Update Form */}
                  <form
                    action={updateApplication}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-border pt-4"
                  >
                    <input type="hidden" name="application_id" value={app.id} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted whitespace-nowrap">Stage:</span>
                      <select
                        name="status"
                        defaultValue={app.status}
                        className="input text-xs py-1.5 w-36"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input
                      type="text"
                      name="reviewer_notes"
                      defaultValue={app.reviewer_notes || ""}
                      placeholder="Add interviewer notes (e.g. Strong React knowledge, schedule round 2)..."
                      className="input text-xs py-1.5 flex-1"
                    />

                    <button type="submit" className="btn-secondary text-xs py-1.5 shrink-0">
                      Update Stage & Note
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
