import js from "@eslint/js";
import tseslint from "typescript-eslint";

const LEGACY_BOUNDARY_MESSAGE =
  "Current workspace code must not import from legacy/. It is a read-only extraction source: reimplement the behaviour against current contracts (AD-13).";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
      "legacy/**",
      "_bmad/render/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CLAUDE.md §3: no `any` without a `// why:` comment.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // AD-13: legacy/ is a read-only extraction source, never a dependency of the
    // current workspace. Extraction means reimplementation against current
    // contracts, so there is deliberately no approved escape hatch for this rule.
    files: ["apps/**", "packages/**", "scripts/**", "tooling/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["legacy", "legacy/*", "**/legacy/**", "*/legacy/*"],
              message: LEGACY_BOUNDARY_MESSAGE,
            },
          ],
        },
      ],
      // `no-restricted-imports` only sees static import/export declarations, so a
      // dynamic `import("../../legacy/x")` would otherwise be an escape hatch.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression > Literal[value=/(^|\\/)legacy(\\/|$)/]",
          message: LEGACY_BOUNDARY_MESSAGE,
        },
      ],
    },
  },
);
