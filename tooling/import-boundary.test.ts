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
