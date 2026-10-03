# Legacy Specification Reconciliation

This file records the disposition of load-bearing content from the former `docs/SPEC.md`. It prevents removed requirements from silently returning through old prompts or code.

| Former specification area | Disposition in the MVP contract |
| --- | --- |
| Eight domains, 140 Pursuits, generic fallback, goal-type displays | Preserved in `product-rules.md` and `pursuit-catalog.md`. |
| Mission hierarchy, real Chapter exits, guides, sources, progressive reveal | Preserved with validated release and full-result persistence. |
| Generation pipeline | Preserved after removing generation-time XP scoring; `MissionGenerated` is now an operational outbox message. |
| Adaptive sizing thresholds | Preserved for future-Step sizing only; never an award input. |
| Tool registry | Preserved, but mere use no longer earns XP and tools never append ledger facts directly. |
| External integrations and two-way calendar | Deferred entirely beyond MVP; `INTEGRATION` cannot award until a provider contract is approved. |
| Estimated-minute XP and difficulty, verification, streak, balance, or rarity multipliers | Superseded. Exact progression policy is an open product decision and must use the architecture's trusted inputs. |
| Daily caps, level curve, rank thresholds, rarity tiers, and provisional threshold | Not approved by the architecture run. Treat the old numbers as proposals only until the SPEC open question is resolved and logged. |
| Shards, Crowns, prices, tiers, trials, paywalls, seasons, shop, gifting, schools, and referrals | Deferred beyond MVP. Any later feature needs a new spec update; paid XP boosts and purchasable streak repair are permanently rejected. |
| Crews, feeds, duels, leaderboards, and notifications | Deferred beyond MVP. Future designs must obey provisional-award, age, privacy, and no-pay-progress rules. |
| Internal scheduling | Preserved. External calendar dependency is removed. |
| Brand palette, life star, earned-only gold, voice, and limited motion | Preserved as starting UX commitments pending a dedicated UX artifact. |
| Legacy Prisma table sketch | Superseded by the architecture's relational/ledger split, Unit of Work, principal aliases, evidence lifecycle, deletion tombstones, and transactional outbox. |
| Age, clinical, eating-risk, self-harm, financial, privacy, and store-safety rules | Preserved and strengthened with server enforcement and deletable personal content. |
| Ten-session feature-first build sequence | Superseded by `docs/BUILD-PROMPTS.md`, which repairs the foundation and freezes contracts before features. |

The former directive that raw Goal text is preserved forever is narrowed to the life of the account and remains subject to valid export/erasure requests.
