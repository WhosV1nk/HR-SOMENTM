import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/utils/supabase/admin";

export type Person = {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  person_type: string;
  employment_type: string | null;
  department: string;
  role: string;
  status: string;
  access_role: "admin" | "member";
  clerk_user_id: string | null;
  mentor_id: string | null;
  cohort: string | null;
  start_date: string | null;
  end_date: string | null;
  [key: string]: unknown;
};

export type Viewer = { person: Person; isAdmin: boolean };

/** Statuses that lose portal access entirely. Completed interns keep access to their records. */
const BLOCKED_STATUSES = new Set(["Terminated"]);

/**
 * The signed-in person, or null when signed out or not approved.
 *
 * "Approved" means a People record exists for one of the user's *verified*
 * Clerk emails and hasn't been deactivated. On first sign-in the record is
 * linked to the Clerk user id; after that the link, not the email, is used,
 * so changing an email in Clerk can't take over someone else's record.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const admin = createAdminClient();
  let { data: person } = await admin.from("people").select("*").eq("clerk_user_id", userId).maybeSingle<Person>();

  if (!person) {
    const user = await currentUser();
    const emails = (user?.emailAddresses ?? [])
      .filter((e) => e.verification?.status === "verified")
      .map((e) => e.emailAddress.toLowerCase());
    if (emails.length === 0) return null;

    const { data: match } = await admin
      .from("people")
      .select("*")
      .in("email", emails)
      .is("clerk_user_id", null)
      .limit(1)
      .maybeSingle<Person>();
    if (!match) return null;

    // claim the record only if nobody has in the meantime
    const { data: claimed } = await admin
      .from("people")
      .update({ clerk_user_id: userId })
      .eq("id", match.id)
      .is("clerk_user_id", null)
      .select("*")
      .maybeSingle<Person>();
    if (!claimed) return null;
    person = claimed;
    await logAction(person.id, "account.linked", "person", person.id);
  }

  if (BLOCKED_STATUSES.has(person.status)) return null;
  return { person, isAdmin: person.access_role === "admin" && person.status === "Active" };
});

/** Any approved person. Unapproved signed-in users go to /no-access. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/no-access");
  return viewer;
}

/** HR admins only. Approved non-admins are sent to their own portal. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect("/portal");
  return viewer;
}

/** Append to the audit trail. Never throws — logging must not break the action. */
export async function logAction(
  actorId: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>,
) {
  try {
    await createAdminClient().from("audit_log").insert({
      actor_id: actorId,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      details: details ?? null,
    });
  } catch (err) {
    console.error("audit_log insert failed:", err);
  }
}
