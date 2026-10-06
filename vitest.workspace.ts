import { defineWorkspace } from "vitest/config";

// Every package that ships tests is discovered here. Pure packages (core,
// economy) are the ones that matter most — see CLAUDE.md §5.
//
// The `tooling` project holds repository guardrail tests. Root-level files are
// not covered by the `packages/*` / `apps/*` globs, so it needs its own entry.
export default defineWorkspace([
  "packages/*",
  "apps/*",
  {
    test: {
      name: "tooling",
      root: import.meta.dirname,
      include: ["tooling/**/*.test.ts"],
    },
  },
]);
