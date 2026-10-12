import { Shield, Building, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { revalidatePath } from "next/cache";
import { Trash2 } from "lucide-react";
import { logAction, requireAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { SectionHead } from "@/components/ui";
import { formatDate, todayIST } from "@/lib/time";
import { LEAVE_ALLOWANCE } from "@/lib/leave";

const SECTIONS = [
  { icon: Building, title: "Organization", body: "Company name, logo, timezone and the working-hours threshold (09:00)." },
  { icon: Shield, title: "Roles & permissions", body: "Access for Super Admin, HR Admin, Manager, Employee and Intern." },
  { icon: Bell, title: "Notifications", body: "Invitation emails via Resend and in-app action alerts." },
];

async function addHoliday(formData: FormData) {
  "use server";
  const { person: actor } = await requireAdmin();
  const date = formData.get("date") as string;
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!date || !name) throw new Error("Add a date and a name.");
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").upsert({ date, name }, { onConflict: "date" });
  if (error) throw new Error(`Couldn't save the holiday: ${error.message}`);
  await logAction(actor.id, "holiday.added", undefined, undefined, { date, name });
  revalidatePath("/settings");
}

async function removeHoliday(formData: FormData) {
  "use server";
  const { person: actor } = await requireAdmin();
  const id = formData.get("id") as string;
  const supabase = await createClient();
  await supabase.from("holidays").delete().eq("id", id);
  await logAction(actor.id, "holiday.removed", undefined, undefined, { id });
  revalidatePath("/settings");
}

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: holidays } = await supabase.from("holidays").select("*").gte("date", `${todayIST().slice(0, 4)}-01-01`).order("date");
  return (
    <div className="mx-auto max-w-7xl space-y-12 px-6 pb-24 pt-10 md:px-10">
      <PageHeader
        eyebrow="System"
        title="Settings,"
        dim="for the whole organization."
        description="Policies, working hours and who can see what."
      />

      <ul className="border-t border-border">
        {SECTIONS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="grid grid-cols-[2rem_1fr] items-baseline gap-x-4 border-b border-border py-7 md:grid-cols-[2rem_18rem_1fr]">
            <span className="index">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="flex items-center gap-3 text-2xl font-medium tracking-tight">
              <Icon size={18} strokeWidth={1.75} className="text-faint" /> {title}
            </h2>
            <p className="col-start-2 mt-2 text-[14px] leading-relaxed text-muted md:col-start-auto md:mt-0">{body}</p>
          </li>
        ))}
      </ul>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-3">
          <SectionHead index="04" title="Holidays" />
          <p className="max-w-xs text-[13px] leading-relaxed text-muted">Shown on everyone&apos;s attendance calendar and dashboard. Saturdays and Sundays are weekly offs.</p>
          <form action={addHoliday} className="space-y-3 pt-2">
            <input type="date" name="date" className="input" required aria-label="Date" />
            <input name="name" className="input" placeholder="e.g. Diwali" required />
            <button className="btn-primary w-full">Add holiday</button>
          </form>
        </div>
        <ul className="border-t border-border lg:col-span-2">
          {holidays?.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-4 border-b border-border py-3.5">
              <span className="text-text">{h.name}</span>
              <span className="flex items-center gap-4">
                <span className="font-mono text-[13px] text-muted">{formatDate(h.date)}</span>
                <form action={removeHoliday}>
                  <input type="hidden" name="id" value={h.id} />
                  <button className="btn-ghost h-8 w-8 !p-0" aria-label={`Remove ${h.name}`}><Trash2 size={14} /></button>
                </form>
              </span>
            </li>
          ))}
          {!holidays?.length && <li className="py-4 text-[13px] text-muted">No holidays added for this year.</li>}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-8 border-t border-border pt-12 lg:grid-cols-3">
        <div className="space-y-3">
          <SectionHead index="05" title="Leave allowance" />
          <p className="max-w-xs text-[13px] leading-relaxed text-muted">Days per calendar year. Change these in <span className="font-mono">lib/leave.ts</span>.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 lg:col-span-2">
          {Object.entries(LEAVE_ALLOWANCE).map(([who, types]) => (
            <dl key={who} className="border-t border-border text-[14px]">
              <div className="label pt-3">{who}s</div>
              {Object.entries(types).map(([t, n]) => (
                <div key={t} className="flex justify-between border-b border-border py-2.5">
                  <dt className="text-muted">{t}</dt>
                  <dd className="font-mono text-text">{n} days</dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      </section>
    </div>
  );
}
