import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { FileText } from "lucide-react";
import { PageHeader, SectionHead } from "@/components/ui";
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
    <div className="mx-auto max-w-7xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="Reports"
        title="Quarterly reports,"
        dim="on the record."
        description="Period summaries and KPI scores for each team member."
      />

      <section className="space-y-5">
        <SectionHead index="01" title="Recent reports" description={`${reports?.length || 0} submitted`} />
        {reports && reports.length > 0 ? (
          <ul className="border-t border-border">
            {reports.map((report: any) => (
              <li key={report.id} className="grid grid-cols-1 gap-4 border-b border-border py-7 md:grid-cols-[10rem_1fr_1.4fr] md:gap-8">
                <div>
                  <div className="display text-5xl tabular-nums">
                    {report.kpi_score}<span className="stat-unit">/ 100</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-faint">{report.report_period}</div>
                </div>
                <div>
                  <div className="text-xl font-medium tracking-tight">{report.employees?.first_name} {report.employees?.last_name}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{report.employees?.role}</div>
                </div>
                <p className="text-[14px] leading-relaxed text-muted">{report.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-border pt-5 text-[13px] text-muted">No reports submitted yet.</p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
        <div className="space-y-3">
          <SectionHead index="02" title="Submit a report" />
          <p className="max-w-xs text-[13px] leading-relaxed text-muted">A period summary with key achievements and a single KPI score.</p>
        </div>
        <form action={createReport} className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label className="label">Employee</label>
              <select name="employee_id" className="input" required>
                <option value="">Select employee</option>
                {employees?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Period</label>
              <input type="text" name="report_period" className="input" placeholder="e.g. Q3 2026" required />
            </div>
            <div>
              <label className="label">KPI score</label>
              <input type="number" name="kpi_score" min="0" max="100" className="input tabular-nums" placeholder="0–100" required />
            </div>
          </div>
          <div>
            <label className="label">Summary & key achievements</label>
            <textarea name="summary" rows={3} className="input" placeholder="Review notes…" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              <FileText size={16} /> Submit report
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
