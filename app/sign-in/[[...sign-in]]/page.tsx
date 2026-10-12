import { SignIn } from "@clerk/nextjs";
import { IrisBackdrop, Wordmark } from "@/components/wordmark";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden p-6">
      <IrisBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-8">
        <Wordmark sub="HR Portal" size="lg" />
        <h1 className="display text-center text-4xl md:text-5xl">
          Welcome
          <span className="headline-dim"> back.</span>
        </h1>
        <SignIn />
      </div>
    </div>
  );
}
