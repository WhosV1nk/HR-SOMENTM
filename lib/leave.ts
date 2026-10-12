/** Annual allowance (days) per leave type. Unpaid has no cap. Edit here to change policy. */
export const LEAVE_ALLOWANCE: Record<"Employee" | "Intern", Record<string, number>> = {
  Employee: { Casual: 12, Sick: 10, Earned: 18 },
  Intern: { Casual: 6, Sick: 6 },
};

export const LEAVE_TYPES = ["Casual", "Sick", "Earned", "Unpaid"] as const;

type LeaveRow = { leave_type: string; status: string | null; duration_days: number; start_date: string };

/** Used / allowed per capped type for the calendar year of `year`. Approved leave only. */
export function leaveBalances(personType: string, requests: LeaveRow[], year = new Date().getFullYear()) {
  const allowance = LEAVE_ALLOWANCE[personType === "Intern" ? "Intern" : "Employee"];
  return Object.entries(allowance).map(([type, total]) => {
    const used = requests
      .filter((r) => r.leave_type === type && r.status === "Approved" && r.start_date.startsWith(String(year)))
      .reduce((n, r) => n + (r.duration_days || 0), 0);
    return { type, used, total, left: Math.max(total - used, 0) };
  });
}
