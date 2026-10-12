import { Shield, Building, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

const SECTIONS = [
  { icon: Building, title: "Organization", body: "Company name, logo, timezone and the working-hours threshold (09:00)." },
  { icon: Shield, title: "Roles & permissions", body: "Access for Super Admin, HR Admin, Manager, Employee and Intern." },
  { icon: Bell, title: "Notifications", body: "Invitation emails via Resend and in-app action alerts." },
];

export default async function SettingsPage() {
  await requireAdmin();
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
    </div>
  );
}
