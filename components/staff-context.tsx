"use client";
import { createContext, useContext } from "react";
export interface StaffUser {
  id: string;
  name: string;
  role: string;
  permissions: string[];
}

const Ctx = createContext<StaffUser | null>(null);
export function StaffProvider({ staff, children }: { staff: StaffUser; children: React.ReactNode }) {
  return <Ctx.Provider value={staff}>{children}</Ctx.Provider>;
}
export function useStaff(): StaffUser {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStaff outside StaffProvider");
  return s;
}
export function useCan(permission: string): boolean {
  const s = useStaff();
  return s.role === "super_admin" || s.permissions.includes(permission);
}
