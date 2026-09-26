## Deferred from: code review (2026-09-22)

- Add deployment-appropriate authentication and/or rate limiting to the public mission-generation endpoint. The correct policy depends on the hosting and identity infrastructure, neither of which exists yet.
- Propagate client cancellation through the AI pipeline so abandoned requests stop consuming model resources. This requires an abort contract across the route, pipeline stages, and model client.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-repair-current-generation-foundations.md`
  summary: Extend grounding and safety validation to mission titles, chapter titles, and chapter exit conditions.
  evidence: The current validators inspect every step field but not higher-level generated text; this predates the repair and requires extending rewrite locations and contracts coherently.

- source_spec: `C:/Users/SIN0119/Zandegi/_bmad-output/implementation-artifacts/spec-repair-current-generation-foundations.md`
  summary: Implement real professional-guidance framing for clinical, financial, and legal missions.
  evidence: `professionalFrameApplied` currently reflects classification rather than inserted user-visible content; the wording and placement require a product/content decision beyond this repair.
