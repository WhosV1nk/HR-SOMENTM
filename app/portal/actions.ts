"use server";

import { revalidatePath } from "next/cache";
import { attempt, type ActionResult } from "@/lib/action-result";
import { logAction, requireViewer } from "@/lib/auth";
import { fileFrom, storeFile } from "@/lib/files";
import { notify } from "@/lib/notify";
import { daysInclusive, todayIST } from "@/lib/time";
import { LEAVE_TYPES } from "@/lib/leave";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

/*
 * Self-service actions. Every one re-checks the signed-in person and writes
 * through the RLS client where a policy exists, so the database enforces
 * "only your own rows" even if these checks were bypassed.
 */

const text = (fd: FormData, k: string) => ((fd.get(k) as string | null) ?? "").trim();

// ---------------------------------------------------------------- attendance

async function checkInImpl() {
  const { person } = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("self_check_in");
  if (error) throw new Error(`Couldn't check in: ${error.message}`);
  await logAction(person.id, "attendance.self_check_in", "person", person.id);
  revalidatePath("/portal", "layout");
}

async function checkOutImpl() {
  const { person } = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("self_check_out");
  if (error) throw new Error(error.message.includes("check in first") ? "Check in before checking out." : `Couldn't check out: ${error.message}`);
  await logAction(person.id, "attendance.self_check_out", "person", person.id);
  revalidatePath("/portal", "layout");
}

async function addWorkLogImpl(fd: FormData) {
  const { person } = await requireViewer();
  const hours = Number(fd.get("hours"));
  const summary = text(fd, "summary");
  const date = text(fd, "date") || todayIST();
  if (!(hours > 0 && hours <= 24) || !summary) throw new Error("Add the hours (0–24) and what you worked on.");
  if (date > todayIST()) throw new Error("You can't log work for a future date.");

  const supabase = await createClient();
  const { error } = await supabase.from("work_logs").insert({ person_id: person.id, date, hours, summary });
  if (error) throw new Error(`Couldn't save the work log: ${error.message}`);
  revalidatePath("/portal/attendance");
}

async function requestCorrectionImpl(fd: FormData) {
  const { person } = await requireViewer();
  const date = text(fd, "date");
  const reason = text(fd, "reason");
  if (!date || !reason) throw new Error("Pick the date and explain what needs correcting.");
  if (date > todayIST()) throw new Error("Corrections are for past days only.");

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_corrections").insert({
    person_id: person.id,
    date,
    requested_check_in: text(fd, "check_in") || null,
    requested_check_out: text(fd, "check_out") || null,
    reason,
    status: "Pending",
  });
  if (error) throw new Error(`Couldn't send the request: ${error.message}`);
  await notify(null, "Attendance correction requested", `${person.first_name} ${person.last_name} · ${date}`, "attendance");
  revalidatePath("/portal/attendance");
}

// --------------------------------------------------------------------- leave

async function applyLeaveImpl(fd: FormData) {
  const { person } = await requireViewer();
  const leave_type = text(fd, "leave_type");
  const start_date = text(fd, "start_date");
  const end_date = text(fd, "end_date");
  const reason = text(fd, "reason");
  if (!LEAVE_TYPES.includes(leave_type as (typeof LEAVE_TYPES)[number])) throw new Error("Pick a leave type.");
  const days = start_date && end_date ? daysInclusive(start_date, end_date) : 0;
  if (days < 1) throw new Error("End date must be on or after the start date.");
  if (!reason) throw new Error("Add a short reason.");

  const supabase = await createClient();
  // no overlapping pending/approved requests
  const { data: overlap } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("person_id", person.id)
    .in("status", ["Pending", "Approved"])
    .lte("start_date", end_date)
    .gte("end_date", start_date)
    .limit(1);
  if (overlap && overlap.length) throw new Error("You already have leave requested for some of those days.");

  const { error } = await supabase.from("leave_requests").insert({
    person_id: person.id,
    leave_type,
    start_date,
    end_date,
    duration_days: days,
    reason,
    status: "Pending",
  });
  if (error) throw new Error(`Couldn't submit the request: ${error.message}`);
  await notify(null, "Leave requested", `${person.first_name} ${person.last_name} · ${leave_type}, ${days} day${days > 1 ? "s" : ""}`, "leave");
  revalidatePath("/portal", "layout");
}

async function raiseHrRequestImpl(fd: FormData) {
  const { person } = await requireViewer();
  const category = text(fd, "category");
  const subject = text(fd, "subject");
  if (!category || !subject) throw new Error("Choose a category and add a subject.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("hr_requests")
    .insert({ person_id: person.id, category, subject, details: text(fd, "details") || null, status: "Open" });
  if (error) throw new Error(`Couldn't send the request: ${error.message}`);
  await notify(null, "New HR request", `${person.first_name} ${person.last_name} · ${subject}`, "request");
  revalidatePath("/portal/leave");
}

// --------------------------------------------------------------------- tasks

async function startTaskImpl(fd: FormData) {
  const { person } = await requireViewer();
  const id = text(fd, "task_id");
  // interns can't update tasks directly (RLS); this narrow change goes via the server
  const admin = createAdminClient();
  await admin
    .from("intern_tasks")
    .update({ status: "In Progress", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("intern_id", person.id)
    .in("status", ["Assigned"]);
  revalidatePath(`/portal/tasks/${id}`);
  revalidatePath("/portal/tasks");
}

async function submitTaskImpl(fd: FormData) {
  const { person } = await requireViewer();
  const task_id = text(fd, "task_id");
  const note = text(fd, "note");
  const link_url = text(fd, "link_url");
  const file = fileFrom(fd, "file");
  if (!note && !link_url && !file) throw new Error("Add a note, a link or a file to submit.");
  if (link_url && !/^https?:\/\//i.test(link_url)) throw new Error("Links must start with http:// or https://");

  const supabase = await createClient();
  // RLS hides other people's tasks; the intern_id check also covers admins, who can see all
  const { data: task } = await supabase.from("intern_tasks").select("id, title, status, intern_id").eq("id", task_id).maybeSingle();
  if (!task || task.intern_id !== person.id) throw new Error("Task not found.");
  if (task.status === "Approved") throw new Error("This task is already approved.");

  const stored = file ? await storeFile(person.id, file, "submissions") : null;
  const { error } = await supabase.from("task_submissions").insert({
    task_id,
    submitted_by: person.id,
    note: note || null,
    link_url: link_url || null,
    file_path: stored?.path ?? null,
    file_name: stored?.name ?? null,
    review_status: "Pending",
  });
  if (error) throw new Error(`Couldn't submit: ${error.message}`);

  await createAdminClient()
    .from("intern_tasks")
    .update({ status: "Submitted", updated_at: new Date().toISOString() })
    .eq("id", task_id)
    .eq("intern_id", person.id);

  // tell the mentor (or HR if none)
  await notify(person.mentor_id ?? null, "Task submitted for review", `${person.first_name} ${person.last_name} · ${task.title}`, "task");
  await logAction(person.id, "task.submitted", "task", task_id);
  revalidatePath(`/portal/tasks/${task_id}`);
  revalidatePath("/portal", "layout");
}

// ----------------------------------------------------------------- documents

const SELF_UPLOAD_KINDS = new Set(["identity", "student_id", "resume", "other"]);

async function uploadDocumentImpl(fd: FormData) {
  const { person } = await requireViewer();
  const kind = text(fd, "kind");
  const file = fileFrom(fd, "file");
  if (!SELF_UPLOAD_KINDS.has(kind)) throw new Error("Choose what kind of document this is.");
  if (!file) throw new Error("Choose a file to upload.");

  const stored = await storeFile(person.id, file, "documents");
  // documents are inserted server-side so status is always Pending: uploading never verifies
  const { error } = await createAdminClient().from("documents").insert({
    person_id: person.id,
    kind,
    title: text(fd, "title") || file.name,
    file_path: stored.path,
    file_name: stored.name,
    mime_type: stored.type,
    size_bytes: stored.size,
    status: "Pending",
    uploaded_by: person.id,
  });
  if (error) throw new Error(`Couldn't save the document: ${error.message}`);
  await notify(null, "Document uploaded", `${person.first_name} ${person.last_name} · ${kind.replace("_", " ")}`, "document");
  await logAction(person.id, "document.uploaded", "person", person.id, { kind });
  revalidatePath("/portal/documents");
}

// ------------------------------------------------------------- notifications

async function markAllReadImpl() {
  const { person } = await requireViewer();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("person_id", person.id).eq("read", false);
  revalidatePath("/portal", "layout");
}

// ------------------------------------------------- exported (prevState, formData) actions

export async function checkIn(_prev: ActionResult, _fd: FormData) {
  return attempt(() => checkInImpl());
}
export async function checkOut(_prev: ActionResult, _fd: FormData) {
  return attempt(() => checkOutImpl());
}
export async function addWorkLog(_prev: ActionResult, fd: FormData) {
  return attempt(() => addWorkLogImpl(fd));
}
export async function requestCorrection(_prev: ActionResult, fd: FormData) {
  return attempt(() => requestCorrectionImpl(fd));
}
export async function applyLeave(_prev: ActionResult, fd: FormData) {
  return attempt(() => applyLeaveImpl(fd));
}
export async function raiseHrRequest(_prev: ActionResult, fd: FormData) {
  return attempt(() => raiseHrRequestImpl(fd));
}
export async function startTask(_prev: ActionResult, fd: FormData) {
  return attempt(() => startTaskImpl(fd));
}
export async function submitTask(_prev: ActionResult, fd: FormData) {
  return attempt(() => submitTaskImpl(fd));
}
export async function uploadDocument(_prev: ActionResult, fd: FormData) {
  return attempt(() => uploadDocumentImpl(fd));
}
export async function markAllRead(_prev: ActionResult, _fd: FormData) {
  return attempt(() => markAllReadImpl());
}
