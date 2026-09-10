"use client";

import { CoachChat } from "@/components/coach/coach-chat";

export default function CoachPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Coach</h1>
        <p className="mt-1 text-sm text-muted">
          Grounded in your actual data across every goal. Ask what to do, why you're stuck, or whether you're on pace.
        </p>
      </div>
      <CoachChat />
    </div>
  );
}
