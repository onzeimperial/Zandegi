import { ESLint } from "eslint";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

// Paths that do not exist on disk are fine: lintText only uses them to resolve
// which flat-config blocks apply to the fixture source.
const fixturePath = path.join(repoRoot, "packages/core/src/__import-boundary-fixture__.ts");
const appFixturePath = path.join(repoRoot, "apps/web/src/app/__import-boundary-fixture__.ts");

// Loading the flat config is the expensive part, so one instance is shared and
// the hook/test budgets are generous enough for a cold CI runner.
const SLOW = 120_000;
let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: repoRoot });
  // Warm the config cache so the first assertion is not also the cold start.
  await eslint.lintText("export {};\n", { filePath: fixturePath });
}, SLOW);

// `no-restricted-imports` covers static import/export declarations;
// `no-restricted-syntax` covers dynamic `import()`. Both carry the AD-13 message.
const BOUNDARY_RULES = new Set(["no-restricted-imports", "no-restricted-syntax"]);

async function boundaryMessages(source: string, filePath: string = fixturePath) {
  const [result] = await eslint.lintText(source, { filePath });
  return {
    result: result!,
    messages: result!.messages.filter(
      (message) => message.ruleId !== null && BOUNDARY_RULES.has(message.ruleId),
    ),
  };
}

describe("legacy import boundary", () => {
  it(
    "fails a current package that imports from legacy/",
    async () => {
      const { result, messages } = await boundaryMessages('import "../../../legacy/src/lib/x";\n');

      expect(messages).toHaveLength(1);
      expect(messages[0]!.severity).toBe(2);
      expect(messages[0]!.message).toContain("AD-13");
      expect(result.filePath).toBe(fixturePath);
      expect(result.errorCount).toBeGreaterThan(0);
    },
    SLOW,
  );

  it(
    "fails a bare legacy specifier and an aliased legacy path",
    async () => {
      for (const specifier of ["legacy", "legacy/src/lib/x", "@/../legacy/src/lib/x"]) {
        const { messages } = await boundaryMessages(`import "${specifier}";\n`);
        expect(messages, specifier).toHaveLength(1);
      }
    },
    SLOW,
  );

  it(
    "fails a dynamic import() of a legacy path, which has no static specifier",
    async () => {
      for (const specifier of ["../../../legacy/src/lib/x", "legacy", "legacy/src/lib/x"]) {
        const { messages } = await boundaryMessages(
          `export const load = () => import(${JSON.stringify(specifier)});\n`,
        );
        expect(messages, specifier).toHaveLength(1);
        expect(messages[0]!.ruleId, specifier).toBe("no-restricted-syntax");
        expect(messages[0]!.message, specifier).toContain("AD-13");
      }
    },
    SLOW,
  );

  it(
    "covers apps/ and not only packages/",
    async () => {
      const { messages } = await boundaryMessages(
        'import "../../../../../legacy/src/lib/x";\n',
        appFixturePath,
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]!.ruleId).toBe("no-restricted-imports");
      expect(messages[0]!.severity).toBe(2);
    },
    SLOW,
  );

  it(
    "stays silent for a @zandegi/* import, static or dynamic",
    async () => {
      const { messages } = await boundaryMessages(
        'import "@zandegi/core";\nexport const load = () => import("@zandegi/core");\n',
      );

      expect(messages).toHaveLength(0);
    },
    SLOW,
  );

  it(
    "does not treat the fixture paths as ignored by the flat config",
    async () => {
      expect(await eslint.isPathIgnored(fixturePath)).toBe(false);
      expect(await eslint.isPathIgnored(appFixturePath)).toBe(false);
    },
    SLOW,
  );
});

// AD-2: an app is a presentation adapter. It calls API use cases and reads
// client-safe contracts; it never reaches into the generation pipeline, the
// database, the economy or the tool runtimes, in runtime or in type position.
describe("application import boundary", () => {
  const FORBIDDEN = ["@zandegi/ai", "@zandegi/db", "@zandegi/economy", "@zandegi/tools"];

  it(
    "fails an app file that imports a server-only package",
    async () => {
      for (const specifier of FORBIDDEN) {
        const { messages } = await boundaryMessages(`import "${specifier}";\n`, appFixturePath);
        expect(messages, specifier).toHaveLength(1);
        expect(messages[0]!.ruleId, specifier).toBe("no-restricted-imports");
        expect(messages[0]!.severity, specifier).toBe(2);
        expect(messages[0]!.message, specifier).toContain("AD-2");
        expect(messages[0]!.message, specifier).toContain(specifier);
      }
    },
    SLOW,
  );

  it(
    "fails a type-only import, which erases at runtime but still couples the app",
    async () => {
      const { messages } = await boundaryMessages(
        'import type { DraftChapter } from "@zandegi/ai";\nexport type X = DraftChapter;\n',
        appFixturePath,
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]!.message).toContain("AD-2");
    },
    SLOW,
  );

  it(
    "fails a deep subpath and a dynamic import of a server-only package",
    async () => {
      const deep = await boundaryMessages('import "@zandegi/ai/pipeline";\n', appFixturePath);
      expect(deep.messages).toHaveLength(1);
      expect(deep.messages[0]!.message).toContain("AD-2");

      const dynamic = await boundaryMessages(
        'export const load = () => import("@zandegi/economy");\n',
        appFixturePath,
      );
      expect(dynamic.messages).toHaveLength(1);
      expect(dynamic.messages[0]!.ruleId).toBe("no-restricted-syntax");
      expect(dynamic.messages[0]!.message).toContain("AD-2");
    },
    SLOW,
  );

  it(
    "stays silent for the seam an app is supposed to use",
    async () => {
      const { messages } = await boundaryMessages(
        [
          'import "@zandegi/api";',
          'import "@zandegi/api/client";',
          'import "@zandegi/core/contracts";',
          'export const load = () => import("@zandegi/api/client");',
          "",
        ].join("\n"),
        appFixturePath,
      );
      expect(messages).toHaveLength(0);
    },
    SLOW,
  );

  it(
    "leaves packages free to depend on a server-only package, as @zandegi/api does",
    async () => {
      const { messages } = await boundaryMessages('import "@zandegi/ai";\n');
      expect(messages).toHaveLength(0);
    },
    SLOW,
  );

  it(
    "still fails a legacy import from an app, now that two rules share the block",
    async () => {
      const { messages } = await boundaryMessages(
        'import "@zandegi/db";\nimport "legacy/src/lib/x";\n',
        appFixturePath,
      );
      expect(messages).toHaveLength(2);
      expect(messages.map((message) => message.message).join(" ")).toContain("AD-13");
    },
    SLOW,
  );
});

// Matrix row: "Lint warning". This shares the warmed instance above rather than
// living beside the other verify-contract assertions, because a second ESLint
// instance in a second test file loads the flat config again in parallel.
//
// The severity is read from the resolved config rather than by linting a typed
// declaration: `lintText` on source containing `any` pulls in the TypeScript
// parser and cost this file ~42 extra seconds on every verify run.
describe("lint warning severity", () => {
  it(
    "configures no-explicit-any at warn or stricter, which --max-warnings 0 can fail",
    async () => {
      const config = await eslint.calculateConfigForFile(fixturePath);

      // ESLint normalises severity to a number: 0 is off, 1 is warn, 2 is error.
      // Only "at least warn" is the contract — tightening the rule to "error", or
      // adding an options object, must not fail the guard that protects it.
      const entry = config.rules?.["@typescript-eslint/no-explicit-any"];

      expect(entry, "no-explicit-any must be configured").toBeDefined();
      expect(entry![0]).toBeGreaterThanOrEqual(1);
    },
    SLOW,
  );
});
