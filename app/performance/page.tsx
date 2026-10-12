import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { PageHeader, SectionHead, StatusBadge } from "@/components/ui";
import { revalidatePath } from "next/cache";

export default async function PerformancePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: people } = await supabase.from("people").select("*").order("first_name");
  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select("*, people(first_name, last_name, role, department)")
    .order("created_at", { ascending: false });

  async function submitPerformanceReview(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const person_id = formData.get("person_id") as string;
    const period = formData.get("period") as string;
    
    const task_completion_score = parseFloat(formData.get("task_completion_score") as string) || 0;
    const quality_score = parseFloat(formData.get("quality_score") as string) || 0;
    const attendance_score = parseFloat(formData.get("attendance_score") as string) || 0;
    const communication_score = parseFloat(formData.get("communication_score") as string) || 0;
    const initiative_score = parseFloat(formData.get("initiative_score") as string) || 0;

    // Weighted Formula: Task 30%, Quality 25%, Attendance 15%, Communication 15%, Initiative 15%
    const overall_score = (
      task_completion_score * 0.30 +
      quality_score * 0.25 +
      attendance_score * 0.15 +
      communication_score * 0.15 +
      initiative_score * 0.15
    );

    let rating = "Good";
    if (overall_score >= 90) rating = "Excellent";
    else if (overall_score >= 80) rating = "Exceeds Expectations";
    else if (overall_score < 70) rating = "Needs Improvement";

    const summary = formData.get("summary") as string;

    await supabase.from("performance_reviews").insert({
      person_id,
      period,
      task_completion_score,
      quality_score,
      attendance_score,
      communication_score,
      initiative_score,
      overall_score,
      rating,
      summary,
    });

    revalidatePath("/performance");
  }

  const SCORES = [
    { name: "task_completion_score", label: "Task completion", weight: "30%" },
    { name: "quality_score", label: "Quality", weight: "25%" },
    { name: "attendance_score", label: "Attendance", weight: "15%" },
    { name: "communication_score", label: "Communication", weight: "15%" },
    { name: "initiative_score", label: "Initiative", weight: "15%" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="Performance"
        title="Reviews,"
        dim="weighted and defensible."
        description="Five scored categories roll up into one overall KPI, so every rating can be explained."
      />

      <section className="space-y-5">
        <SectionHead index="01" title="Scorecards" description={`${reviews?.length || 0} reviews`} />
        {reviews && reviews.length > 0 ? (
          <ul className="border-t border-border">
            {reviews.map((r: any) => (
              <li key={r.id} className="grid grid-cols-1 gap-4 border-b border-border py-7 md:grid-cols-[10rem_1fr_1.4fr] md:gap-8">
                <div>
                  <div className="display text-5xl tabular-nums">
                    {Math.round(r.overall_score)}<span className="stat-unit">/ 100</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-faint">{r.period}</div>
                </div>
                <div>
                  <div className="text-xl font-medium tracking-tight">{r.people?.first_name} {r.people?.last_name}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{r.people?.role}</div>
                  <div className="mt-3"><StatusBadge status={r.rating} /></div>
                </div>
                <p className="text-[14px] leading-relaxed text-muted">{r.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-border pt-5 text-[13px] text-muted">No reviews submitted yet.</p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
        <div className="space-y-3">
          <SectionHead index="02" title="Submit a review" />
          <p className="max-w-xs text-[13px] leading-relaxed text-muted">
            Score each category 0–100. The overall KPI is weighted: task 30%, quality 25%, attendance, communication and initiative 15% each.
          </p>
        </div>
        <form action={submitPerformanceReview} className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="label">Person</label>
              <select name="person_id" className="input" required>
                <option value="">Select employee or intern</option>
                {people?.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Period</label>
              <input type="text" name="period" className="input" placeholder="e.g. Q3 2026" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-5">
            {SCORES.map((sc) => (
              <div key={sc.name}>
                <label className="label">
                  {sc.label} <span className="text-faint">· {sc.weight}</span>
                </label>
                <input type="number" name={sc.name} min="0" max="100" className="input tabular-nums" placeholder="0–100" required />
              </div>
            ))}
          </div>
          <div>
            <label className="label">Summary & feedback</label>
            <textarea name="summary" rows={3} className="input" placeholder="Evaluation notes…" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Calculate & submit</button>
          </div>
        </form>
      </section>
    </div>
  );
}
