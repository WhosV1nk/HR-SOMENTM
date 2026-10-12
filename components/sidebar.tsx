"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Calendar, 
  CalendarDays, 
  TrendingUp, 
  FileText, 
  Settings 
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsBell } from "./notifications-bell";
import { StatusPill, Wordmark } from "./wordmark";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

const NAV_SECTIONS = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "PEOPLE",
    items: [
      { href: "/people", label: "People", icon: Users },
      { href: "/interns", label: "Interns", icon: GraduationCap },
    ]
  },
  {
    title: "TIME",
    items: [
      { href: "/attendance", label: "Attendance", icon: Calendar },
      { href: "/leave", label: "Leave", icon: CalendarDays },
    ]
  },
  {
    title: "PERFORMANCE",
    items: [
      { href: "/performance", label: "Performance", icon: TrendingUp },
      { href: "/reports", label: "Reports", icon: FileText },
    ]
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ]
  }
];

export function Sidebar() {
  const path = usePathname();

  if (path.startsWith("/sign-in") || path.startsWith("/sign-up") || path.startsWith("/onboarding")) {
    return null;
  }
  
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border bg-bg/70 backdrop-blur-xl md:flex">
      <div className="flex items-center justify-between px-5 pb-6 pt-6">
        <Wordmark sub="HR Portal" />
        <NotificationsBell />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3" aria-label="Primary">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="space-y-0.5">
            {section.title && (
              <div className="mb-2 flex items-center gap-2 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-faint">
                <span className="tabular-nums">{String(sIdx).padStart(2, "0")}</span>
                {section.title}
              </div>
            )}
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition ${
                    active
                      ? "bg-white/[0.07] text-text light:bg-black/[0.05]"
                      : "text-muted hover:bg-white/[0.04] hover:text-text light:hover:bg-black/[0.04]"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} className={active ? "text-text" : "text-faint transition-colors group-hover:text-text"} />
                  {label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(255,59,59,0.8)]" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        <div className="px-3 py-1.5">
          <StatusPill label="HR System" detail="live" />
        </div>
        <ThemeToggle />

        <Show when="signed-in">
          <div className="flex items-center gap-2.5 rounded-2xl border border-border px-3 py-2.5">
            <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
            <div className="min-w-0 text-xs">
              <div className="truncate font-medium text-text">Account</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ok">Signed in</div>
            </div>
          </div>
        </Show>

        <Show when="signed-out">
          <div className="flex flex-col gap-1.5 p-1">
            <SignInButton mode="modal">
              <button className="btn-secondary btn-sm w-full">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn-primary btn-sm w-full">Sign up</button>
            </SignUpButton>
          </div>
        </Show>
      </div>
    </aside>
  );
}
