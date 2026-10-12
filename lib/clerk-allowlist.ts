import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Mirror People into Clerk's sign-up allowlist. This only takes effect if
 * "Allowlist" is switched on in Clerk → Configure → Restrictions; the
 * guarantee is always the People check in lib/auth.ts. Best-effort: a Clerk
 * outage or a plan without allowlists must never block HR.
 */
export async function allowEmail(email: string) {
  try {
    const clerk = await clerkClient();
    await clerk.allowlistIdentifiers.createAllowlistIdentifier({ identifier: email.toLowerCase(), notify: false });
  } catch (err) {
    console.warn("Clerk allowlist add skipped:", (err as Error).message);
  }
}

export async function disallowEmail(email: string) {
  try {
    const clerk = await clerkClient();
    const { data } = await clerk.allowlistIdentifiers.getAllowlistIdentifierList();
    const match = data.find((i) => i.identifier.toLowerCase() === email.toLowerCase());
    if (match) await clerk.allowlistIdentifiers.deleteAllowlistIdentifier(match.id);
  } catch (err) {
    console.warn("Clerk allowlist removal skipped:", (err as Error).message);
  }
}
