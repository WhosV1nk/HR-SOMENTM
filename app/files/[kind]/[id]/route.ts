import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { signedUrl } from "@/lib/files";
import { createClient } from "@/utils/supabase/server";

const SOURCES = {
  document: { table: "documents", column: "file_path" },
  submission: { table: "task_submissions", column: "file_path" },
} as const;

/**
 * GET /files/document/<id> or /files/submission/<id>
 * The row is fetched as the signed-in user, so RLS decides whether they may
 * see it; only then is a two-minute signed URL issued.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const source = SOURCES[kind as keyof typeof SOURCES];
  if (!source) return new NextResponse("Not found", { status: 404 });

  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const { data } = await supabase.from(source.table).select(source.column).eq("id", id).maybeSingle();
  const path = (data as Record<string, string | null> | null)?.[source.column];
  if (!path) return new NextResponse("Not found", { status: 404 });

  const url = await signedUrl(path);
  if (!url) return new NextResponse("File unavailable", { status: 404 });
  return NextResponse.redirect(url);
}
