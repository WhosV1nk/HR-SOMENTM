import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase client acting as the signed-in Clerk user. Supabase verifies the
 * Clerk session token (third-party auth), so Row Level Security decides what
 * this client can read and write. Signed out → anonymous → RLS denies.
 */
export async function createClient() {
  const { getToken } = await auth();
  return createSupabaseClient(supabaseUrl!, supabaseKey!, {
    accessToken: async () => (await getToken()) ?? null,
  });
}
