import fs from "node:fs";
import path from "node:path";
import prettier from "prettier";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

type Manifest = { scripts?: Record<string, string> };

function readManifest(relativePath: string): Manifest {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8")) as Manifest;
}

const manifest = readManifest("package.json");
const scripts = manifest.scripts ?? {};

// This file deliberately does not construct an `ESLint` instance. Vitest isolates
// the module registry per file, so a second instance means a second flat-config
// load running in parallel with the first — which took this suite from seconds to
// tens of minutes. The one ESLint-backed assertion this matrix row needs lives in
// `import-boundary.test.ts`, on the instance that is already warmed there. The
// invariant is enforced by a test at the bottom of this file, not just this note.

// Matrix row: "Any stage fails". The chain is `&&`-joined, so a non-zero exit at
// any stage stops the command and propagates. Running every stage for real is
// what `pnpm verify` itself does in CI; this pins the wiring that makes the
// propagation true, and the cheapest-first order that makes it useful.
describe("canonical verify chain", () => {
  const stages = ["format:check", "lint", "typecheck", "test", "build"];

  it("chains every stage with && in cheapest-first order", () => {
    expect(scripts, "the canonical command must exist").toHaveProperty("verify");

    const steps = scripts.verify!.split("&&").map((step) => step.trim());

    expect(steps).toEqual(stages.map((stage) => `pnpm ${stage}`));
  });

  it("defines every stage it chains", () => {
    for (const stage of stages) {
      expect(scripts, stage).toHaveProperty(stage);
    }
  });

  it("does not enter legacy/, which has its own script and CI job", () => {
    expect(scripts.verify).not.toContain("legacy");
    expect(scripts["verify:legacy"]).toContain("npm --prefix legacy");
  });
});

// The build stage is the slowest and the easiest to quietly neuter: a script name
// alone proves nothing, so pin that the root stage really recurses and that the
// one package with a production build still declares it.
describe("build stage runs real production builds", () => {
  it("recurses across the workspace", () => {
    expect(scripts.build).toMatch(/^pnpm -r (run )?build$/);
  });

  it("reaches the web production build", () => {
    expect(readManifest("apps/web/package.json").scripts).toHaveProperty("build");
  });
});

// Counting type-check projects in prose goes stale the moment a placeholder app
// gains a tsconfig. The contract that matters is that every project with a
// tsconfig is reachable from the stage, and that the repository-level contract
// files are type-checked too — `pnpm -r` alone never sees them.
describe("typecheck stage covers every project", () => {
  const workspaceDirectories = ["apps", "packages"].flatMap((group) =>
    fs
      .readdirSync(path.join(repoRoot, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${group}/${entry.name}`),
  );

  it("declares a typecheck script wherever a tsconfig exists", () => {
    const projects = workspaceDirectories.filter((directory) =>
      fs.existsSync(path.join(repoRoot, directory, "tsconfig.json")),
    );

    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) {
      expect(readManifest(`${project}/package.json`).scripts, project).toHaveProperty("typecheck");
    }
  });

  it("recurses into every workspace project and also checks the contract files", () => {
    expect(scripts.typecheck).toContain("pnpm -r typecheck");
    expect(scripts.typecheck).toContain("tsc -p tsconfig.tooling.json");

    const tooling = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "tsconfig.tooling.json"), "utf8"),
    ) as { include: string[] };

    expect(tooling.include).toEqual(
      expect.arrayContaining(["tooling/**/*.ts", "vitest.workspace.ts", "eslint.config.js"]),
    );
  });
});

// Matrix row: "Fresh checkout". CI must run the same command a developer runs,
// or the canonical gate is only canonical locally.
describe("CI runs the canonical command", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/verify.yml"), "utf8");

  function jobBlock(name: string): string {
    const lines = workflow.split("\n");
    const start = lines.findIndex((line) => line === `  ${name}:`);
    expect(start, `job ${name} must exist`).toBeGreaterThanOrEqual(0);
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^ {2}\S/.test(line));
    return (end === -1 ? rest : rest.slice(0, end)).join("\n");
  }

  it("runs pnpm verify in the current job", () => {
    const current = jobBlock("current");

    expect(current).toMatch(/^ *- run: pnpm verify$/m);
    expect(current).not.toContain("verify:current");
  });

  it("keeps legacy in its own job that never runs from the pnpm workspace", () => {
    const legacy = jobBlock("legacy");

    expect(legacy).toContain("working-directory: legacy");
    expect(legacy).toContain("npm ci");
  });
});

// Matrix row: "Lint warning". `no-explicit-any` is a warning, so only
// --max-warnings 0 lets it fail the gate, which is what CLAUDE.md §3 relies on.
// The severity itself is asserted in `import-boundary.test.ts`.
describe("lint fails on warnings", () => {
  it("runs eslint with --max-warnings 0", () => {
    expect(scripts.lint).toContain("--max-warnings 0");
  });
});

// Matrix row: "Unreadable path". `_bmad/render` holds directories whose ACLs
// cannot be read. Prettier applies .prettierignore to matched files but still
// walks the tree, so the scripts must also exclude it on the command line or the
// format stage dies on EPERM instead of reporting the repo's real state.
describe("format stage excludes the unreadable tree", () => {
  it("ignores _bmad/render through .prettierignore", async () => {
    const info = await prettier.getFileInfo(path.join(repoRoot, "_bmad/render/x/index.ts"), {
      ignorePath: path.join(repoRoot, ".prettierignore"),
    });

    expect(info.ignored).toBe(true);
  });

  it("also excludes _bmad on the command line in both format scripts", () => {
    for (const script of ["format", "format:check"] as const) {
      expect(scripts[script], script).toContain('"!_bmad/**"');
    }
  });
});

// A second ESLint instance loads the flat config a second time, in parallel with
// the first, and that regression took this suite from seconds to ~2333s. Keep it
// enforced rather than merely documented.
describe("only one tooling test constructs an ESLint instance", () => {
  it("holds across every file in tooling/", () => {
    // Assembled at runtime so this guard does not match its own source.
    const needle = `new ${"ESLint"}(`;
    const owners = fs
      .readdirSync(path.join(repoRoot, "tooling"))
      .filter((file) => file.endsWith(".ts"))
      .filter((file) =>
        fs.readFileSync(path.join(repoRoot, "tooling", file), "utf8").includes(needle),
      );

    expect(owners).toEqual(["import-boundary.test.ts"]);
  });
});
