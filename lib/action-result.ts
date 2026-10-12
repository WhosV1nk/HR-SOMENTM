import "server-only";
import { unstable_rethrow } from "next/navigation";

export type ActionResult = { ok?: boolean; error?: string; message?: string } | null;

/**
 * Run a server action body and turn thrown errors into data. In production
 * Next.js hides thrown error messages from the browser, so validation errors
 * ("File is over 4 MB") must be *returned* to be shown. redirect()/notFound()
 * are rethrown so they keep working.
 */
export async function attempt(fn: () => Promise<void | string>): Promise<ActionResult> {
  try {
    const message = await fn();
    return { ok: true, message: message || undefined };
  } catch (err) {
    unstable_rethrow(err);
    console.error(err);
    return { error: err instanceof Error ? err.message : "Something went wrong. Please try again." };
  }
}
