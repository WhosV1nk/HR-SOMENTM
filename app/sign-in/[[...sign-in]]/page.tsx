import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#090a0c]">
      <div className="mb-6 text-center space-y-1">
        <span className="text-2xl font-black tracking-[0.25em] text-red-500">SOMENTM</span>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">HR Command Center • Admin Portal</div>
      </div>
      <SignIn />
    </div>
  );
}
