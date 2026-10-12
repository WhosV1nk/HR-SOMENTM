import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { Lock } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { IrisBackdrop, Wordmark } from "@/components/wordmark";

export default async function NoAccessPage() {
  // approved after all (e.g. HR just added them) — send them on
  const viewer = await getViewer();
  if (viewer) redirect(viewer.isAdmin ? "/" : "/portal");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-6">
      <IrisBackdrop />
      <div className="relative z-10 flex max-w-md flex-col items-center gap-8 text-center">
        <Wordmark sub="HR Portal" size="lg" />
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-danger/30 bg-danger-soft text-brand-2">
          <Lock size={20} />
        </div>
        <h1 className="display text-4xl">
          Not on the list
          <span className="headline-dim"> — yet.</span>
        </h1>
        <p className="text-[15px] leading-relaxed text-muted">
          {email ? (
            <>
              <b className="font-medium text-text">{email}</b> isn&apos;t an approved SOMENTM account.
            </>
          ) : (
            "This account isn't approved for SOMENTM."
          )}{" "}
          Access is limited to people HR has added. If you think this is a mistake, contact HR and sign in with the email they registered for you.
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <button className="btn-secondary">Sign out and use another email</button>
        </SignOutButton>
      </div>
    </div>
  );
}
