# Generating celebration clips

`library/manifest.json` holds the curated library that `selectCelebrationClip`
(`src/select.ts`) picks from. Nothing in this package calls Seedance live — every
clip in the manifest was generated ahead of time, offline, and reviewed before it
shipped. That's a deliberate design choice: CLAUDE.md §2.5 keeps model calls off
anything that affects what a user sees on the completion path.

## Why this is a manual process today

There's no confirmed plain REST endpoint for Seedance outside the MCP server
configured in `.mcp.json` (`https://seedance.mcp.acedata.cloud/mcp`). Until one
exists, new clips are generated interactively in a Claude Code session using the
`seedance_*` MCP tools, then hand-appended to the manifest. If AceDataCloud exposes
a plain REST API later, this becomes a scriptable batch job — don't build that
speculatively before it's needed.

## Process for adding a clip

1. **Build the prompt** with `buildCelebrationPrompt(domain, eventType, variant)`
   from `src/prompt.ts` — don't hand-write prompts, so the manifest's `prompt`
   field stays reproducible from code.
2. **Generate** via `seedance_generate_video_from_image`, passing the character
   reference image as `first_frame_url` and `generate_audio: true` (requires a
   1.5-pro or 2.x model — see `seedance_list_models`) so the clip carries its
   own music. **The reference image alone is not enough to hold the character
   design** — the pilot batch proved this: identical reference image, random
   seed, no explicit description in the prompt produced wildly different,
   off-brand characters on 2 of 3 runs. `buildCelebrationPrompt` always
   includes `CHARACTER_DESCRIPTION` (exported from `src/prompt.ts`) to restate
   the colors, emblem, and proportions in words every time — don't drop it.
3. **Poll** with `seedance_get_task` until the generation completes.
4. **Review** the clip before it ships — character consistency, motion quality,
   no artifacts. Reject and regenerate (different seed/variant) rather than
   shipping a bad clip.
5. **Download and commit** the clip rather than linking the Seedance CDN URL
   directly — save it to `library/generated/<id>.mp4` and set `videoUrl` to
   that repo-relative path. (See "Known limitation: storage" below for why.)
6. **Append** an entry to `library/manifest.json`:

   ```json
   {
     "id": "body-step_complete-1",
     "domain": "Body",
     "eventType": "step_complete",
     "variant": 1,
     "videoUrl": "library/generated/body-step_complete-1.mp4",
     "durationSec": 4,
     "hasAudio": true,
     "prompt": "<exact prompt passed to Seedance>",
     "referenceImageUrl": "library/reference/mascot-ref.jpg",
     "model": "doubao-seedance-1-5-pro-251215",
     "generatedAt": "<ISO timestamp>",
     "sourceTaskId": "<the Seedance task_id, for traceability via seedance_get_task>"
   }
   ```

   `id` convention: `<domain>-<eventType>-<variant>`, all lowercase, domain and
   eventType as they appear in `src/types.ts`.

   `domain` may be one of the 8 real domains, or `"Universal"` for a
   base-character clip not yet skinned to a specific domain.
   `selectCelebrationClip` tries an exact domain match first, then falls back
   to `"Universal"` clips of the same event type, then to `null`.

## Known limitation: storage

Clips are downloaded and committed to `library/generated/` as binary files in
git, rather than left pointing at the Seedance CDN URL — that URL isn't
guaranteed to stay live. Committing binaries to git is itself not a long-term
answer (repo bloat as the library grows to the full matrix). Before this ships
to real users, clips need to move to storage Zandegi controls (R2 or S3,
matching the pattern Session 8 of `docs/BUILD-PROMPTS.md` establishes for
`ARTIFACT` verification uploads), with `videoUrl` pointing there instead. That's
infrastructure work, tracked here rather than silently deferred.

## Rollout order

1. **Pilot — done (2026-09-20)**: one `"Universal"` clip per event type
   (step/chapter/level-up), generated live, reviewed for character consistency,
   and committed. Took two attempts: the first batch drifted badly off-brand on
   2 of 3 clips from image-reference alone; adding `CHARACTER_DESCRIPTION` text
   to every prompt fixed it. See `library/manifest.json`.
2. **Full matrix**: fill in the remaining 8 domains × 3 event types × 2–3
   variants (~48–72 clips). Do this in batches per domain, not all at once —
   review each domain's clips before moving to the next, same as the pilot.
