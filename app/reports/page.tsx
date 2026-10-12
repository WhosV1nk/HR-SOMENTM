import { redirect } from "next/navigation";

// The old reports module wrote to the legacy `employees` / `employee_reports`
// tables. Reviews now live in performance_reviews; reporting is rebuilt there.
export default function ReportsPage() {
  redirect("/performance");
}
