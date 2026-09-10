import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">Z</span> Zandegi
        </Link>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Every goal becomes a path you can see and walk.
          </h2>
          <p className="mt-3 max-w-md text-sm text-white/80">
            Milestones, a skill tree, a task backlog, XP and a coach that adapts — for whatever you're
            working toward.
          </p>
        </div>
        <p className="text-xs text-white/60">Private by default. Your data stays yours.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
