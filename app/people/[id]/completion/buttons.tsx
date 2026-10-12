"use client";

import { useActionState } from "react";
import { BadgeCheck, Save, Send, Undo2 } from "lucide-react";

type ActionResult = { ok?: boolean; error?: string; message?: string } | null;
type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/**
 * Several submit buttons for one form, each posting the same fields to a
 * different server action, with the latest result shown underneath.
 */
export function CompletionButtons({
  saveDraft,
  submit,
  approve,
  returnToDraft,
  blocked,
}: {
  saveDraft: Action;
  submit: Action | null;
  approve: Action | null;
  returnToDraft: Action | null;
  blocked: boolean;
}) {
  const [s1, a1, p1] = useActionState(saveDraft, null);
  const [s2, a2, p2] = useActionState(submit ?? (async () => null), null);
  const [s3, a3, p3] = useActionState(approve ?? (async () => null), null);
  const [s4, a4, p4] = useActionState(returnToDraft ?? (async () => null), null);
  const pending = p1 || p2 || p3 || p4;
  const last = [s3, s2, s4, s1].find((s) => s);

  return (
    <div className="flex w-full flex-col items-end gap-3">
      <div className="flex flex-wrap justify-end gap-2">
        {returnToDraft && (
          <button formAction={a4} disabled={pending} className="btn-ghost btn-sm"><Undo2 size={14} /> Back to draft</button>
        )}
        <button formAction={a1} disabled={pending} className="btn-secondary"><Save size={15} /> Save draft</button>
        {submit && (
          <button formAction={a2} disabled={pending || blocked} className="btn-secondary"><Send size={15} /> Submit for approval</button>
        )}
        {approve && (
          <button
            formAction={a3}
            disabled={pending || blocked}
            className="btn-primary"
            onClick={(e) => {
              if (!confirm("Issue the certificate now? The intern is notified and the internship is marked completed.")) e.preventDefault();
            }}
          >
            <BadgeCheck size={15} /> Approve &amp; issue
          </button>
        )}
      </div>
      {pending && <p className="text-[13px] text-muted">Working…</p>}
      {!pending && last?.error && <p role="alert" className="text-[13px] text-brand-2">{last.error}</p>}
      {!pending && last?.ok && last.message && <p role="status" className="text-[13px] text-ok">{last.message}</p>}
    </div>
  );
}
