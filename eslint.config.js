import js from "@eslint/js";
import tseslint from "typescript-eslint";

const LEGACY_BOUNDARY_MESSAGE =
  "Current workspace code must not import from legacy/. It is a read-only extraction source: reimplement the behaviour against current contracts (AD-13).";

// AD-13: legacy/ is a read-only extraction source, never a dependency of the
// current workspace. Extraction means reimplementation against current
// contracts, so there is deliberately no approved escape hatch for this rule.
const LEGACY_PATTERN = {
  group: ["legacy", "legacy/*", "**/legacy/**", "*/legacy/*"],
  message: LEGACY_BOUNDARY_MESSAGE,
};

// `no-restricted-imports` only sees static import/export declarations, so a
// dynamic `import("../../legacy/x")` would otherwise be an escape hatch.
const LEGACY_DYNAMIC_IMPORT = {
  selector: "ImportExpression > Literal[value=/(^|\\/)legacy(\\/|$)/]",
  message: LEGACY_BOUNDARY_MESSAGE,
};

// AD-2: an app is a presentation adapter. It calls API use cases through
// `@zandegi/api` (server) or `@zandegi/api/client` (client) and reads
// contracts from `@zandegi/core/contracts`. Reaching past that seam — into the
// generation pipeline, Prisma, the economy or the tool runtimes — puts
// server-only policy, provider credentials and progression numbers where a
// client can see them. A package may legitimately depend on these (as
// `@zandegi/api` depends on `@zandegi/ai`); an app may not.
const APP_BOUNDARY_MESSAGE =
  "Apps must not import @zandegi/ai, @zandegi/db, @zandegi/economy or @zandegi/tools, in runtime or type position. Call an API use case through @zandegi/api (server) or @zandegi/api/client (client), and read contracts from @zandegi/core/contracts (AD-2).";

const SERVER_ONLY_PACKAGES = ["@zandegi/ai", "@zandegi/db", "@zandegi/economy", "@zandegi/tools"];

const APP_BOUNDARY_PATTERN = {
  group: SERVER_ONLY_PACKAGES.flatMap((name) => [name, `${name}/*`]),
  message: APP_BOUNDARY_MESSAGE,
};

const APP_BOUNDARY_DYNAMIC_IMPORT = {
  selector: "ImportExpression > Literal[value=/^@zandegi\\/(ai|db|economy|tools)(\\/|$)/]",
  message: APP_BOUNDARY_MESSAGE,
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
      "packages/db/src/generated/**",
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
    files: ["apps/**", "packages/**", "scripts/**", "tooling/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [LEGACY_PATTERN] }],
      "no-restricted-syntax": ["error", LEGACY_DYNAMIC_IMPORT],
    },
  },
  {
    // Flat config replaces a rule's options wholesale rather than merging
    // them, so this block repeats the legacy boundary alongside the app
    // boundary: apps are subject to both.
    files: ["apps/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [LEGACY_PATTERN, APP_BOUNDARY_PATTERN] }],
      "no-restricted-syntax": ["error", LEGACY_DYNAMIC_IMPORT, APP_BOUNDARY_DYNAMIC_IMPORT],
    },
  },
);
