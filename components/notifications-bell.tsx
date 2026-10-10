"use client";
import { Bell } from "lucide-react";

export function NotificationsBell() {
  return (
    <button className="relative flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-muted transition hover:bg-surface-3 hover:text-text">
      <Bell size={16} />
      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />
    </button>
  );
}
