"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-2xl font-semibold tracking-tight">Something broke</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          An unexpected error occurred. Your data is safe.
        </p>
        <button onClick={reset} className="btn-primary mt-6">Try again</button>
      </div>
    </div>
  );
}
