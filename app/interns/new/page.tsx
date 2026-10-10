import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function InternsNewRedirectPage() {
  redirect("/people/new");
}
