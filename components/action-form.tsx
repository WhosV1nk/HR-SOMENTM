"use client";

import { useActionState, useEffect, useRef } from "react";

type ActionResult = { ok?: boolean; error?: string; message?: string } | null;

/**
 * <form> for server actions shaped (prevState, formData) => ActionResult.
 * Shows the returned error inline, disables inputs while pending, and clears
 * the fields after a successful submit (unless `keep`).
 */
export function ActionForm({
  action,
  children,
  className,
  keep = false,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  keep?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && !keep) ref.current?.reset();
  }, [state, keep]);

  return (
    <form ref={ref} action={formAction} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && (
        <p role="alert" className="col-span-full basis-full text-[13px] text-brand-2">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="col-span-full basis-full text-[13px] text-ok">
          {state.message}
        </p>
      )}
    </form>
  );
}
