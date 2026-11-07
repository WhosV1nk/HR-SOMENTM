import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { signedUrl } from "@/lib/files";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const SOURCES = {
  document: { table: "documents", column: "file_path" },
  submission: { table: "task_submissions", column: "file_path" },
  resume: { table: "internship_applications", column: "resume_file_path" },
} as const;

/**
 * GET /files/document/<id> or /files/submission/<id> or /files/resume/<id>
 * Authenticated viewers (admin for resume; RLS for others) receive a two-minute signed URL.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const source = SOURCES[kind as keyof typeof SOURCES];
  if (!source) return new NextResponse("Not found", { status: 404 });

  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });

  if (kind === "resume") {
    if (!viewer.isAdmin) return new NextResponse("Forbidden", { status: 403 });
    const admin = createAdminClient();
    const { data } = await admin.from(source.table).select(source.column).eq("id", id).maybeSingle();
    const path = (data as Record<string, string | null> | null)?.[source.column];
    if (!path) return new NextResponse("Not found", { status: 404 });
    const url = await signedUrl(path);
    if (!url) return new NextResponse("File unavailable", { status: 404 });
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { data } = await supabase.from(source.table).select(source.column).eq("id", id).maybeSingle();
  const path = (data as Record<string, string | null> | null)?.[source.column];
  if (!path) return new NextResponse("Not found", { status: 404 });

  const url = await signedUrl(path);
  if (!url) return new NextResponse("File unavailable", { status: 404 });
  return NextResponse.redirect(url);
}
