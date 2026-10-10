import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { FileText, Plus } from "lucide-react";
import { revalidatePath } from "next/cache";

export default async function ReportsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: employees } = await supabase.from("employees").select("*").order("first_name");
  const { data: reports } = await supabase
    .from("employee_reports")
    .select("*, employees(first_name, last_name, role, department)")
    .order("created_at", { ascending: false });

  async function createReport(formData: FormData) {
    "use server";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const employee_id = formData.get("employee_id") as string;
    const report_period = formData.get("report_period") as string;
    const summary = formData.get("summary") as string;
    const kpi_score = parseFloat(formData.get("kpi_score") as string) || 0;

    await supabase.from("employee_reports").insert({
      employee_id,
      report_period,
      summary,
      kpi_score,
    });

    revalidatePath("/reports");
  }

  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="page-title text-text">Employee Reports & Reviews</h1>
        <p className="mt-2 text-muted">Performance tracking and quarterly reports for team members.</p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
          <Plus size={18} /> Submit Performance Report
        </h2>
        <form action={createReport} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Employee</label>
              <select name="employee_id" className="input" required>
                <option value="">Select Employee</option>
                {employees?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Report Period</label>
              <input type="text" name="report_period" className="input" placeholder="e.g. Q3 2026" required />
            </div>
            <div>
              <label className="label">KPI Score (0-100)</label>
              <input type="number" name="kpi_score" min="0" max="100" className="input" placeholder="e.g. 92" required />
            </div>
          </div>
          <div>
            <label className="label">Summary & Key Achievements</label>
            <textarea name="summary" rows={3} className="input" placeholder="Enter performance review notes..." required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              <FileText size={16} /> Submit Report
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-text">Recent Reports</h2>
        <div className="grid grid-cols-1 gap-4">
          {reports && reports.length > 0 ? (
            reports.map((report: any) => (
              <div key={report.id} className="card p-5 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-text">
                      {report.employees?.first_name} {report.employees?.last_name}
                    </span>
                    <span className="badge-secondary">{report.employees?.role}</span>
                    <span className="badge-secondary">{report.report_period}</span>
                  </div>
                  <p className="text-sm text-muted mt-2">{report.summary}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-500">{report.kpi_score}%</div>
                  <div className="text-xs text-muted">KPI Score</div>
                </div>
              </div>
            ))
          ) : (
            <div className="card p-8 text-center text-muted">No reports submitted yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
