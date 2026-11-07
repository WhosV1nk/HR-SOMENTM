import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";

const BUCKET = "documents";
/** Vercel caps request bodies at 4.5 MB, so stay safely under it. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "text/plain",
]);

/** A File from FormData, or null when the input was left empty. */
export function fileFrom(formData: FormData, name: string): File | null {
  const f = formData.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}

/**
 * Store a file privately under the person's folder. Callers must have already
 * checked that the signed-in user may write for `personId`.
 */
export async function storeFile(personId: string, file: File, folder: string) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`"${file.name}" is over 4 MB. Please upload a smaller file.`);
  if (file.type && !ALLOWED_TYPES.has(file.type)) throw new Error(`"${file.name}" isn't an accepted file type (PDF, image, Word, ZIP or text).`);

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${personId}/${folder}/${randomUUID()}-${safeName}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { path, name: file.name, type: file.type || null, size: file.size };
}

/**
 * Store an applicant's resume under the applications folder.
 */
export async function storeApplicationResume(applicationId: string, file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`"${file.name}" is over 4 MB. Please upload a smaller file.`);
  if (file.type && !ALLOWED_TYPES.has(file.type)) throw new Error(`"${file.name}" isn't an accepted file type (PDF, Word, or text).`);

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `applications/${applicationId}/${randomUUID()}-${safeName}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(`Resume upload failed: ${error.message}`);
  return { path, name: file.name, type: file.type || null, size: file.size };
}

/**
 * Short-lived download link. Only call after checking the viewer may see the
 * file (their own, a mentee's, or an admin).
 */
export async function signedUrl(path: string, seconds = 120) {
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
