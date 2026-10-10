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
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-border bg-[#0d0e12]/80 backdrop-blur-xl md:flex">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Wordmark sub="HR Portal" />
        <NotificationsBell />
      </div>

      <nav className="flex-1 space-y-4 px-3 overflow-y-auto" aria-label="Primary">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {section.title && (
              <div className="px-3 text-[10px] font-semibold tracking-[0.18em] text-muted/70 uppercase mb-1">
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
                  className={`group flex items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] font-medium transition ${
                    active 
                      ? "bg-white/[0.08] text-white shadow-sm light:bg-black/[0.06]" 
                      : "text-muted hover:bg-white/[0.04] hover:text-white light:hover:bg-black/[0.04]"
                  }`}
                >
                  <Icon size={16} className={active ? "text-red-500" : "text-faint transition-colors group-hover:text-white"} />
                  {label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ff4d6d]" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border/60 p-3 bg-surface/30">
        <StatusPill label="HR System" detail="live" className="w-full" />
        <ThemeToggle />
        
        <Show when="signed-in">
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface-2 border border-border/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
              <div className="min-w-0 text-xs">
                <div className="truncate font-semibold text-text">Account</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-400">Authenticated</div>
              </div>
            </div>
          </div>
        </Show>

        <Show when="signed-out">
          <div className="flex flex-col gap-1.5 p-1">
            <SignInButton mode="modal">
              <button className="btn-secondary w-full text-xs py-1.5 justify-center">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn-primary w-full text-xs py-1.5 justify-center">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </Show>
      </div>
    </aside>
  );
}
