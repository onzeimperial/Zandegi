import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <p className="mt-2 text-sm text-muted">That page doesn&apos;t exist.</p>
        <Link href="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    </div>
  );
}
