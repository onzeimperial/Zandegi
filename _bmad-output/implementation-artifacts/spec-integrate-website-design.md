---
title: 'Integrate the Zandegi website design'
type: 'feature'
created: '2026-09-27'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'ac4c027655b7cd528d9fce4d6412b08cfb17c0ed'
context:
  - '{project-root}/design/WebsiteDesign.html'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web app currently exposes a placeholder home page and a functional but visually minimal mission generator, while the supplied 12-board Zandegi design defines the intended product experience. The design is a bundled prototype rather than reusable application source, and most screens imply backend capabilities that do not exist yet.

**Approach:** Rebuild the supplied design as responsive, accessible Next.js UI and make it the visual source of truth. Integrate the existing mission-generation API and SSE stream into the designed ambition, build-progress, and review states; represent the remaining boards with clearly isolated typed fixture data until their backends are implemented.

## Boundaries & Constraints

**Always:** Preserve the current `/api/generate` request, validation, abort/timeout, error, refusal, and SSE contracts. Preserve all AI/core safety and scoring behavior. Implement every supplied board as an application route or real generator state. Match the 1440×900 reference closely while permitting vertical scrolling and adding sensible tablet/mobile reflow. Use semantic landmarks, forms, labels, keyboard operation, visible focus, live progress announcements, reduced-motion support, and AA-safe text contrast. Keep mock state in UI-only fixture modules with honest preview/demo treatment. Use the installed Next.js/React runtime and strict TypeScript.

**Never:** Import or serve the prototype bundler, CDN React runtime, blob URLs, generated `sc-camel-*` bindings, hard-coded 1440×900 overflow clipping, corrupted glyphs, unresolved `[PRICE]` copy, or unverified embedded font/image binaries. Do not fabricate persistence, authentication, verification, purchases, scheduling, rankings, rewards, or AI output fields. Do not modify the API, AI pipeline, or core packages merely to fit the mockup. Do not mix unrelated existing worktree changes into this implementation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Generate mission | Valid ambition submitted | Exact `{ rawText }` request; real streamed stages drive designed progress; terminal payload renders review | Submit remains disabled while active; abort on unmount/retry |
| API refusal/error | Refusal, JSON HTTP error, SSE error, or premature EOF | Designed error/refusal panel retains ambition and offers retry | No invented review data; expose safe server message |
| Partial stream | Detail events without a chapter | Progress text updates without adding a chapter | Add chapter only when `event.chapter` exists |
| Outcome goal | Result disallows percentage display | Review shows honest qualitative progress | Never synthesize a metric percentage |
| Backendless route | User opens Path, Step, Profile, Crew, Shop, or Customise | Complete designed screen renders from typed fixtures and navigates locally | Mutating controls are marked preview, disabled, or local-only |
| Small viewport | 375–768px width | Content reflows, navigation remains operable, no essential content is clipped | Horizontal overflow is prevented except deliberate scrollers |

</frozen-after-approval>

## Code Map

- `design/WebsiteDesign.html` — authoritative visual reference containing 12 independent desktop boards.
- `apps/web/src/app/globals.css` — replace conflicting dark tokens with the light Zandegi design system, shared utilities, focus, motion, and responsive rules.
- `apps/web/src/app/layout.tsx` — global metadata/font strategy and document shell.
- `apps/web/src/app/page.tsx` — primary designed entry point, replacing the placeholder.
- `apps/web/src/app/generate/page.tsx` — current live generator entry.
- `apps/web/src/app/generate/sse.ts` — protected stream consumer contract; reuse without semantic changes.
- `apps/web/src/app/api/generate/route.ts` — protected server transport boundary.
- `apps/web/src/components/` — shared brand, controls, app shell, status rail, mission review, and responsive navigation.
- `apps/web/src/app/(product)/` and route pages — designed Path, Step, completion, profile, crew, shop, and customise screens.
- `apps/web/src/lib/demo-data.ts` — typed UI-only fixtures for capabilities without persistence.
- `apps/web/vitest.config.ts` and UI tests — extend testing to TSX DOM behavior without weakening existing suites.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/globals.css`, `layout.tsx`, and shared components — establish reusable design tokens, typography, controls, shell, icons, responsive behavior, and accessibility states.
- [x] `apps/web/src/app/generate/**` — refactor the existing client into ambition, real streamed build-progress, review, refusal, and retry states while retaining its transport behavior.
- [x] `apps/web/src/app/page.tsx` and auth/onboarding/manual-builder routes — implement the designed entry and pre-mission screens with local interaction where no backend exists.
- [x] Product routes and `apps/web/src/lib/demo-data.ts` — implement Path, Step, completion, Profile, Crew, Shop, and Customise boards using isolated fixtures and valid Next.js navigation.
- [x] UI test configuration and tests — cover request shape, streamed state transitions, refusal/errors, chapter gating, goal-type progress, keyboard semantics, and key responsive rendering.

**Acceptance Criteria:**
- Given the supplied HTML, when each target route is viewed at 1440×900, then its hierarchy, palette, spacing, typography character, card/button treatment, and navigation correspond closely to the matching board.
- Given a valid ambition, when generation completes, then the user remains in one client state machine and can review the actual `PipelineResult` without relying on nonexistent persistence.
- Given navigation across implemented screens, when a destination is selected, then it resolves to a real Next.js route with current-page state and no prototype filenames or dead `#` links.
- Given keyboard-only or reduced-motion use, when interacting with the UI, then all controls remain named, focusable, understandable, and usable.
- Given existing repository checks, when the integration is complete, then previous generation/API/core tests remain green.

## Implementation Notes

- Rebuilt the 12 design boards as 11 routes plus the live generator's ambition, progress, refusal/error, and review states. The existing API/SSE/core contracts were not changed.
- Added shared app-shell, brand, icon, status-rail, review, fixture, local builder, and local customisation modules. Embedded prototype assets were deliberately excluded because provenance is unknown.
- Added auth, generator, SSE, route-boundary, review, builder, and customiser coverage. Final repository verification passed with 192 tests across 29 files, all 10 TypeScript projects, ESLint, and a production build; `pnpm` was unavailable, so equivalent local binaries were used.
- Manual screenshot and assistive-technology comparison remains a handoff check because no browser runner is installed in this environment.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence |
|---|---|---|
| Blind 1 — generated mission Start opens fixture Path | medium | `MissionReview` links to `/path`, whose mission is always the Bench 100 kg fixture; the generated result is not persisted or transferred. Route: patch with honest preview wording. |
| Blind 2 — generated mission Tweak opens preset builder | medium | `MissionReview` links to `/builder`, whose reducer always initializes Get into medicine. Route: patch with honest example-builder wording. |
| Blind 3 — builder Continue discards edits | medium | The builder CTA links directly to fixture `/path` and no builder state crosses the route. Route: patch the handoff wording so loss is explicit. |
| Blind 4 — mobile builder Continue is hidden | medium | The only Continue link is the header's last child and the 768px rule hides every onboarding header's last child. Route: patch with a reachable mobile CTA. |
| Blind 5 — controlled chapter details re-close | medium | Every rerender reapplies `open={index===1}`, overriding a user's disclosure state after editing. Route: patch to uncontrolled initial disclosure. |
| Blind 6 — metric inputs lose values | medium | Now/Target are uncontrolled DOM values absent from `BuilderState`; unmounting them via the goal-type toggle destroys entered values. Route: patch state/actions and coverage. |
| Blind 7 — Log & verify bypasses evidence | medium | `/step` links to completion with unchecked sets and no photo/evidence path. Route: patch as an explicitly non-mutating verified-state preview. |
| Blind 8 — completion asserts unsupported rewards | medium | `/complete` is directly reachable and says verified/rewarded despite only a persistence disclaimer. Route: patch copy to identify the entire screen as a design preview. |
| Blind 9 — completed path node is an inert button | low | The enabled button has no handler; keyboard/pointer activation does nothing. Route: patch to non-interactive marked-up status. |
| Blind 10 — customisation is unreachable from Profile | medium | No application link targets `/customise`; only direct URL entry reaches it. Route: patch Profile navigation. |
| Blind 11 — customisation CTA discards selections | medium | The link returns to a static profile and the local reducer unmounts. Route: patch the CTA/copy so reset is explicit. |
| Blind 12 — hydrate appears completed while active | medium | During hydrate, `activeIndex > resolveIndex` makes `done` win before the active class/detail is selected. Route: patch precedence. |
| Blind 13 — generated review is not announced/focused | medium | The focused input/form unmounts and the replacement review has no focus target or live-region semantics. Route: patch accessible completion discovery. |
| Blind 14 — refusal panel is not announced | medium | The async error panel has `role=alert`; the parallel refusal panel has no status/alert role. Route: patch equivalent semantics. |
| Blind 15 — profile streak conflicts with rail | low | Profile shows 14 while its simultaneously rendered `StatusRail` shows 13. Route: patch fixture consistency. |
| Verification 1 — generator orchestration lacks page-level coverage | medium | Pre-verified: tests cover request helper, reducer, and SSE parser separately, but never execute `GeneratePage` wiring; removing progress/result/retry/abort connections leaves them green. Route: patch focused orchestration coverage. |
| Verification 2 — auth keyboard controls lack interaction coverage | medium | Pre-verified: static markup and a pure destination helper are tested, but button handlers can be removed without failure. Route: patch interaction-level coverage. |
| Edge 1 — hydrate active-state error | medium | Verified duplicate of Blind 12 at the same branch. Route: patch. |
| Edge 2 — refusal announcement gap | medium | Verified duplicate of Blind 14 at the refusal branch. Route: patch. |
| Edge 3 — Tweak silently replaces generated mission | medium | Verified duplicate of Blind 2; builder initial state is unrelated. Route: patch. |
| Edge 4 — Start silently replaces generated mission | medium | Verified duplicate of Blind 1; Path is fixture-backed. Route: patch. |
| Edge 5 — professional-guidance notice was removed | high | The old UI surfaced `professionalFrameApplied`; the new review never reads that safety field, so material safety framing disappears. Route: patch the review notice and test it. |
| Edge 6 — responsive-rendering claim is only a source scan | medium | The route test merely searches for media-query strings, which cannot catch clipping or unreachable controls. Route: patch stronger route/mobile contracts and retain the documented manual browser gate. |
| Edge 7 — keyboard claim is static markup only | medium | Verified duplicate of Verification 2; no control is activated. Route: patch interaction-level coverage. |

## Design Notes

Use the design’s Baloo/Nunito character through approved font sources or robust fallbacks; do not extract unlicensed binaries. Recreate or temporarily represent the mascot with a code-safe branded placeholder unless asset provenance is confirmed. Prefer server components for static route frames and narrowly scoped client components for forms, accordions, generator state, and customisation controls.

## Verification

**Commands:**
- `pnpm lint` — expected: no lint regressions.
- `pnpm typecheck` — expected: strict TypeScript passes.
- `pnpm test` — expected: existing and new suites pass.
- `pnpm --filter @zandegi/web build` — expected: all routes build successfully.

**Manual checks:**
- Compare all boards at 1440×900 and verify reflow at 768×1024 and 375×812.
- Complete ambition → generation → review using an intercepted stream; inspect keyboard focus, screen-reader status, refusal/error, retry, and reduced-motion behavior.
