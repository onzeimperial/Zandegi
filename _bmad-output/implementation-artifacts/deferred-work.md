## Deferred from: code review (2026-09-22)

- Add deployment-appropriate authentication and/or rate limiting to the public mission-generation endpoint. The correct policy depends on the hosting and identity infrastructure, neither of which exists yet.
- Propagate client cancellation through the AI pipeline so abandoned requests stop consuming model resources. This requires an abort contract across the route, pipeline stages, and model client.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-repair-current-generation-foundations.md`
  summary: Extend grounding and safety validation to mission titles, chapter titles, and chapter exit conditions.
  evidence: The current validators inspect every step field but not higher-level generated text; this predates the repair and requires extending rewrite locations and contracts coherently.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-repair-current-generation-foundations.md`
  summary: Implement real professional-guidance framing for clinical, financial, and legal missions.
  evidence: `professionalFrameApplied` currently reflects classification rather than inserted user-visible content; the wording and placement require a product/content decision beyond this repair.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-1-2-add-verification-and-repository-guardrails.md`
  summary: Clean up environment configuration and add fail-fast runtime config validation — strip legacy SQLite and NextAuth from `.env.example`, blank all credential-shaped example values, distinguish local/preview/production variables, and fail startup with a safe actionable error on missing, malformed, client-exposed, or environment-mismatched config without logging secrets.
  evidence: Split from Story 1.2 during build intent clarification. Story 1.2's acceptance criteria covered both repository verification guardrails and environment/runtime config hygiene; these are independently shippable (repo tooling versus application startup code) and the config validation belongs on the server side of the API seam that Story 1.3 establishes.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-1-2-add-verification-and-repository-guardrails.md`
  summary: Decouple `apps/web/src/app/routes.test.ts` from raw source text, so formatting changes cannot break or silently weaken it.
  evidence: Reformatting already broke five assertions in this file. The remaining `not.toContain('href="#"')`, `not.toContain("fetch(")`, `:focus-visible` and `aria-live="assertive"` assertions still match unformatted source, and the negative ones fail open — a reformat makes them pass while asserting nothing. Pre-existing coupling, not introduced by Story 1.2.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-1-2-add-verification-and-repository-guardrails.md`
  summary: Tune CI cost and hygiene now that a production build runs inside the canonical gate, and widen `.prettierignore` to cover `coverage`, `out` and `.turbo`.
  evidence: `verify.yml` declares both `on: push` and `on: pull_request` with no `concurrency` group, so every PR commit now runs `next build` twice. The `current` job caches neither the pnpm store nor `.next/cache`, though the `legacy` job does cache npm, and no `permissions:` block is declared. The double-run and missing permissions pre-date this story; adding the build stage is what made the cost material.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-1-3-put-mission-generation-behind-the-api-boundary.md`
  summary: Finish AC1 by forbidding `apps/**` from importing `@zandegi/core` root, and migrate the three app files that still do.
  evidence: Story 1.3 enforced four of the five surfaces AC1 names. `apps/web/src/app/builder/builder-state.ts:1` imports the scoring formula `verificationMult` from core root and renders `+N XP` at `builder/page.tsx:274`; `lib/domain-art.ts:1` imports `DOMAINS`; `lib/demo-data.ts:1` imports `GoalType`, which the contracts subpath already carries. Blocked on two things: `DOMAINS` belongs in the contracts surface that story 1.4 owns, and whether a client screen may compute XP from published formulas at all is a product decision, not a refactor.
  decision: Settled 2026-11-03 in `sprint-change-proposal-2026-11-03.md`. Under AD-5, a client screen may not show XP before completion, and Story 7.4 removes the builder's `+N XP`. The import-boundary work stays open.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-1-3-put-mission-generation-behind-the-api-boundary.md`
  summary: Strengthen the terminal-frame guard in `apps/web/src/app/generate/sse.ts` to validate step shape, not just that `steps` is an array.
  evidence: `mission-review.tsx` dereferences `step.guide.approach`, `step.estimatedMinutes` and `step.verification`, so a malformed frame passes `isProgress`/the terminal guard and throws during render. Not a regression — the previous `isMissionGeneratedEvent` was weaker — and frames originate from our own server, so this is hardening rather than a live defect.


- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-two-person-mvp-test.md`
  summary: Intake fields from the 2026-10-10 brainstorm that this test left out: finish-line type with current and target numbers, deadline kind (hard, soft or none), shape of the time (one long block or short daily sessions, time of day), benchmarks and how they were measured, past attempts, parts of the goal, an explicit budget, how predictable life is, and strengths.
  evidence: The spec allows five free-text and date fields plus hours and location. `_bmad-output/brainstorming/brainstorm-ambition-intake-fields-2026-10-10/.memlog.md` holds the rest. Structured baseline and goal numbers belong to Story 7.3, and its rule keeping them out of prompts still stands.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-two-person-mvp-test.md`
  summary: Give the support refusal real help. A person routed to support sees "This needs a person, not a mission." and a button to change their ambition, with no crisis line or next step.
  evidence: Details make this path easier to reach, since free text now goes to the classifier. The copy predates this work, and what to show, in which country, is a product and clinical decision rather than a code change.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-two-person-mvp-test.md`
  summary: Hand the classifier the person's own goal text, not only the model's summary of it. Details reach stage 2 verbatim; `rawText` still reaches it only as stage 1's `intent`.
  evidence: The spec's verbatim rule names details, and "ambition only generates as today". Worrying wording in the goal itself depends on stage 1 restating it faithfully.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-two-person-mvp-test.md`
  summary: Decide whether a failed generation should give its daily slot back. Today it does not, because its model calls were still paid for, so five failures in a row lock a person out until the next UTC day.
  evidence: Acceptable for two people and a default of 5. `ZANDEGI_DAILY_GENERATION_LIMIT` raises the cap on the next redeploy. Revisit before a wider test.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-two-person-mvp-test.md`
  summary: Cache the Clerk user lookup. Every API request and page load calls `currentUser()`, one Backend API round trip, to read verified emails.
  evidence: Harmless for two people. A session claim holding the verified addresses would avoid it, at the cost of Clerk dashboard configuration that cannot be tested here.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-two-person-mvp-test.md`
  summary: `.env.example` still names the legacy AI, rate-limit and knowledge variables that nothing current reads. The SQLite and NextAuth blocks are gone, which closes that part of the Story 1.2 config item; fail-fast validation stays with it.
  evidence: Only variables this spec touched were changed.
