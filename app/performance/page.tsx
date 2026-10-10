import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { TrendingUp, Award, Plus, Star } from "lucide-react";
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

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title text-white">Performance & Structured KPIs</h1>
        <p className="mt-1 text-sm text-muted">Defensible weighted performance reviews and objective scoring models.</p>
      </div>

      {/* Submit Structured Review */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Plus size={18} className="text-red-400" /> Submit Category Evaluation
        </h2>
        <form action={submitPerformanceReview} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Person</label>
              <select name="person_id" className="input" required>
                <option value="">Select Employee/Intern</option>
                {people?.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Evaluation Period</label>
              <input type="text" name="period" className="input" placeholder="e.g. Q3 2026" required />
            </div>
            <div>
              <label className="label">Task Completion Score (30%)</label>
              <input type="number" name="task_completion_score" min="0" max="100" className="input" placeholder="0-100" required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Quality Score (25%)</label>
              <input type="number" name="quality_score" min="0" max="100" className="input" placeholder="0-100" required />
            </div>
            <div>
              <label className="label">Attendance Score (15%)</label>
              <input type="number" name="attendance_score" min="0" max="100" className="input" placeholder="0-100" required />
            </div>
            <div>
              <label className="label">Communication Score (15%)</label>
              <input type="number" name="communication_score" min="0" max="100" className="input" placeholder="0-100" required />
            </div>
            <div>
              <label className="label">Initiative Score (15%)</label>
              <input type="number" name="initiative_score" min="0" max="100" className="input" placeholder="0-100" required />
            </div>
          </div>

          <div>
            <label className="label">Executive Summary / Feedback</label>
            <textarea name="summary" rows={2} className="input" placeholder="Enter evaluation notes..." required />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Calculate & Submit Review</button>
          </div>
        </form>
      </div>

      {/* Reviews Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-surface-2/40">
          <h2 className="text-sm font-semibold text-white">Performance Scorecards</h2>
        </div>
        <table className="table w-full">
          <thead>
            <tr>
              <th>Person</th>
              <th>Period</th>
              <th>Overall KPI Score</th>
              <th>Rating</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {reviews && reviews.length > 0 ? (
              reviews.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-semibold text-text">{r.people?.first_name} {r.people?.last_name}</div>
                    <div className="text-[11px] text-muted">{r.people?.role}</div>
                  </td>
                  <td><span className="badge-secondary">{r.period}</span></td>
                  <td className="font-bold text-base text-red-400 font-mono">{r.overall_score}%</td>
                  <td>
                    <span className="badge-success">🟢 {r.rating}</span>
                  </td>
                  <td className="text-xs text-muted max-w-sm truncate">{r.summary}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center py-10 text-muted">No evaluations submitted yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
