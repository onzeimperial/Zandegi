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
