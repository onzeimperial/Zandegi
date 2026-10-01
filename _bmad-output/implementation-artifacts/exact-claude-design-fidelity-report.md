# Exact Claude Design fidelity implementation report

Superseded 1 October 2026. The 29 September version of this report is withdrawn.

## What the 29 September report claimed, and why it was wrong

It reported all twelve boards ported, six of them pixel-identical. In fact no board was ported.
`scripts/capture-rendered-design.cjs` scraped `document.body.innerHTML` out of each Claude reference
page into `apps/web/src/generated/design-boards.json`, and every route rendered that string through
`dangerouslySetInnerHTML`. The pixel comparison therefore measured the export against itself, which
is why six boards scored exactly 0.000% — the only possible result, not an achievement.

The consequences were real: `min-width:1440px` plus overridden media queries made every screen fail
the 375px rule in CLAUDE.md §6; interactivity was simulated with `cloneNode` and `style.cssText`
swaps against script-stripped markup; and the live generation screen still rendered the earlier
approximation, because the authored design only appeared behind `?visual=` preview URLs.

## Current state

All twelve boards are real React components. The injector components, the generated JSON, the
scraping script and the self-referential fidelity test are deleted.

Measured at 1440x900, changed pixels against the reference:

| Board | Route | Changed |
|---|---|---|
| 00 | `/` | 0.312% |
| 01 | `/generate` (ambition) | 2.348% |
| 02 | live build progress | not reachable by URL |
| 03 | live review | not reachable by URL |
| 04 | `/builder` | 1.258% |
| 05 | `/path` | 0% |
| 06 | `/step` | 0.099% |
| 07 | `/complete` | 0% |
| 08 | `/profile` | 0.307% |
| 09 | `/crew` | 0.059% |
| 10 | `/shop` | 0% |
| 11 | `/customise` | 0.099% |

Boards 02 and 03 are the real `generating` and `done` states of the SSE pipeline. They exist only
after a live generation, so they are excluded from the automated sweep and still need one manual
pass with a working API key.

Every route is free of horizontal overflow at 375px.

## Deliberate divergences from the mock

The export is a visual mock, not a source of truth for behaviour or vocabulary. Four divergences are
intentional, recorded as allowances in `scripts/compare-claude-design.cjs`, and explained in
`docs/BUILD-LOG.md`: the eight domain names come from SPEC §1.1 and `@zandegi/core` rather than the
mock's placeholders; the build screen shows the pipeline's real eight stages rather than the mock's
five; step XP comes from core's `verificationMult` rather than the mock's hardcoded 20/40/60; and
misleading mock copy and states are corrected, including a "Draft saved" pill on a draft that is not
saved.

## Verification

ESLint clean. All 10 TypeScript projects clean. 197 tests across 30 files pass. Next.js production
build passes. `node scripts/compare-claude-design.cjs` exits 0.

Acceptance is a human review of the side-by-side sheets under `visual-diffs/side-by-side/`, not a
threshold the tooling sets for itself.
