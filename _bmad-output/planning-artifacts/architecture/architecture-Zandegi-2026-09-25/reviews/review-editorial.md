# Editorial review — legacy extraction and repair plan

This document exists to help Zandegi's implementation team repair the foundation and extract useful legacy behaviour in a safe dependency order.

**Reader:** humans  
**Style guide:** Microsoft Writing Style Guide  
**Structure model:** Strategic/Context (Pyramid) leading into Tutorial/Guide (Linear)  
**Final word count:** 1,973

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| structure | `MVP Boundary` after all phase descriptions | MOVE before `Dependency-Safe Build Sequence` | The release boundary is now known before the reader enters the detailed roadmap; no net word reduction. |
| structure | Phase gate table followed by phase explanations | PRESERVE | The table supports scanning while the short phase paragraphs supply necessary implementation meaning; removing either would weaken handoff quality. |

The prose pass found no communication error that justified rewriting technical terms or changing the author's concise directive voice.

Two recommendations were evaluated; one move was accepted and one apparently duplicative structure was deliberately preserved. Estimated reduction: 0 words (0%). There was no length target and no comprehension trade-off from the accepted move.

```json
[
  {
    "lens": "structure",
    "location": "MVP Boundary",
    "trigger_condition": "The MVP finish line appeared only after the detailed phase sequence.",
    "guard_snippet": "Move MVP Boundary before Dependency-Safe Build Sequence.",
    "potential_consequence": "Readers can mistake post-MVP work for part of the immediate implementation scope.",
    "disposition": "accepted"
  },
  {
    "lens": "structure",
    "location": "Dependency-Safe Build Sequence",
    "trigger_condition": "The summary gate table and phase paragraphs look superficially repetitive.",
    "guard_snippet": "Preserve both: the table is the completion index and the paragraphs define implementation meaning.",
    "potential_consequence": "Cutting either would make the plan less scannable or less actionable.",
    "disposition": "preserve"
  }
]
```
