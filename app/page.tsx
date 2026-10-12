import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { logAction, requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Avatar, Empty, PageHeader, SectionHead, Stat, StatusBadge } from "@/components/ui";

export default async function Dashboard() {
  await requireAdmin();
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  // Single Source of Truth Queries from database
  const [
    { count: totalPeople },
    { count: totalEmployees },
    { count: totalInterns },
    { data: attendanceToday },
    { data: peopleList },
    { data: pendingLeaves },
    { data: activeInterns }
  ] = await Promise.all([
    supabase.from("people").select("*", { count: "exact", head: true }),
    supabase.from("people").select("*", { count: "exact", head: true }).eq("person_type", "Employee"),
    supabase.from("people").select("*", { count: "exact", head: true }).eq("person_type", "Intern").eq("status", "Active"),
    supabase.from("attendance").select("*, people(first_name, last_name, department, role)").eq("date", today),
    supabase.from("people").select("*").order("first_name"),
    supabase.from("leave_requests").select("*, people(first_name, last_name)").eq("status", "Pending"),
    supabase.from("people").select("*").eq("person_type", "Intern").eq("status", "Active")
  ]);

  const presentCount = attendanceToday?.filter(a => a.status === "Present" || a.status === "Late").length || 0;
  const lateCount = attendanceToday?.filter(a => a.status === "Late").length || 0;
  const absentCount = attendanceToday?.filter(a => a.status === "Absent").length || 0;

  // Server action for Check-in / Check-out session management
  async function toggleCheckIn(formData: FormData) {
    "use server";
    const { person: actor } = await requireAdmin();
    const supabase = await createClient();
    
    const person_id = formData.get("person_id") as string;
    const action_type = formData.get("action_type") as string;
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0].substring(0, 5);

    if (action_type === "check_in") {
      const isLate = now.getHours() >= 10;
      await supabase.from("attendance").upsert({
        person_id,
        date: today,
        check_in: timeStr,
        status: isLate ? "Late" : "Present",
        method: "Self Check-in",
      }, { onConflict: "person_id,date" });
    } else {
      await supabase.from("attendance").update({
        check_out: timeStr,
      }).eq("person_id", person_id).eq("date", today);
    }

    await logAction(actor.id, `attendance.${action_type}`, "person", person_id);
    revalidatePath("/");
  }

  const attendanceRate = totalPeople ? Math.round((presentCount / totalPeople) * 100) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow={`Today · ${today}`}
        title="Your people,"
        dim="at a glance."
        description="Live check-ins, headcount and what needs a decision — one view for the SOMENTM team."
      >
        {/* Session check-in */}
        <form action={toggleCheckIn} className="flex flex-wrap items-center gap-2">
          <select name="person_id" className="input w-56 rounded-full py-2" required aria-label="Person">
            <option value="">Select person</option>
            {peopleList?.map(p => {
              const record = attendanceToday?.find(a => a.person_id === p.id);
              return (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} {record?.check_in ? (record.check_out ? "(Checked out)" : "(Checked in)") : ""}
                </option>
              );
            })}
          </select>
          <button type="submit" name="action_type" value="check_in" className="btn-primary">Check in</button>
          <button type="submit" name="action_type" value="check_out" className="btn-secondary">Check out</button>
        </form>
      </PageHeader>

      {/* Headline numbers */}
      <section className="stat-strip">
        <Stat label="Total people" value={totalPeople || 0} hint="Across all departments" />
        <Stat label="Employees" value={totalEmployees || 0} hint="Full-time, part-time & founders" />
        <Stat label="Active interns" value={totalInterns || 0} hint="Current program participants" />
        <Stat
          label="Present today"
          value={presentCount}
          unit={totalPeople ? `/ ${totalPeople}` : undefined}
          hint={
            attendanceRate !== null ? (
              <>
                <span className="text-ok">{attendanceRate}%</span> · {lateCount} late · {absentCount} absent
              </>
            ) : (
              "No active workforce"
            )
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        {/* Today's attendance */}
        <section className="space-y-5 lg:col-span-2">
          <SectionHead index="01" title="Today's attendance" description={`Check-in log for ${today}`} href="/attendance" hrefLabel="Full log" />
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="!pl-5">Person</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>In</th>
                  <th>Out</th>
                </tr>
              </thead>
              <tbody>
                {attendanceToday && attendanceToday.length > 0 ? (
                  attendanceToday.map((record) => (
                    <tr key={record.id}>
                      <td className="!pl-5">
                        <div className="flex items-center gap-3">
                          <Avatar first={record.people?.first_name} last={record.people?.last_name} />
                          <div>
                            <div className="font-medium text-text">{record.people?.first_name} {record.people?.last_name}</div>
                            <div className="text-[12px] text-muted">{record.people?.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted">{record.people?.department}</td>
                      <td><StatusBadge status={record.status} /></td>
                      <td className="font-mono text-xs text-muted">{record.check_in || "—"}</td>
                      <td className="font-mono text-xs text-muted">{record.check_out || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <Empty colSpan={5}>No check-ins yet today.</Empty>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-12">
          {/* Needs a decision */}
          <section className="space-y-5">
            <SectionHead index="02" title="Needs a decision" />
            <ul className="border-t border-border">
              {[
                { href: "/leave", title: "Leave requests", detail: `${pendingLeaves?.length || 0} pending approval`, cta: "Review" },
                { href: "/interns", title: "Intern program", detail: `${totalInterns || 0} active intern${totalInterns !== 1 ? "s" : ""}`, cta: "Manage" },
              ].map((item) => (
                <li key={item.href} className="border-b border-border">
                  <Link href={item.href} className="group flex items-center justify-between py-4">
                    <div>
                      <div className="font-medium text-text">{item.title}</div>
                      <div className="text-[13px] text-muted">{item.detail}</div>
                    </div>
                    <span className="link text-muted group-hover:text-brand-2">
                      {item.cta} <ArrowUpRight size={14} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Milestones */}
          <section className="space-y-5">
            <SectionHead index="03" title="Upcoming milestones" />
            {activeInterns && activeInterns.length > 0 ? (
              <ul className="border-t border-border">
                {activeInterns.map(intern => (
                  <li key={intern.id} className="flex items-center gap-4 border-b border-border py-4">
                    <div className="w-10 shrink-0 text-center">
                      <div className="display text-2xl tabular-nums">{intern.end_date?.split("-")[2] || "—"}</div>
                      <div className="index uppercase">{intern.end_date ? new Date(intern.end_date).toLocaleString("en", { month: "short" }) : ""}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-text">{intern.cohort || "Internship"} ends</div>
                      <div className="truncate text-[13px] text-muted">{intern.first_name} {intern.last_name} · {intern.department}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-border pt-4 text-[13px] text-muted">No upcoming intern milestones.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
