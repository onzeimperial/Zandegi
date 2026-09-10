export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet text-2xl font-bold">Z</div>
      <h1 className="text-3xl font-bold tracking-tight">Zandegi</h1>
      <p className="text-sm text-white/60">
        Monorepo scaffold. The real build starts at BUILD-PROMPTS session 1 — proving the mission
        generator is good.
      </p>
    </main>
  );
}
