import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * In-app notification. `personId` null = the HR feed (admins).
 * Never throws: a failed notification must not undo the action that caused it.
 */
export async function notify(personId: string | null, title: string, message: string, type = "info") {
  try {
    await createAdminClient().from("notifications").insert({ person_id: personId, title, message, type, read: false });
  } catch (err) {
    console.error("notification insert failed:", err);
  }
}
