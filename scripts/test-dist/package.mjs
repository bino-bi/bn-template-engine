/**
 * Checks the npm package the way a consumer gets it: pack it, install the
 * tarball into an empty project, then use every entry point of the `exports`
 * map and type-check a strict file against the published types.
 *
 * Run after `npm run build`. Needs the npm registry for the dependencies.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NAME = "@bino-bi/bn-template-engine";

let project;
let packedFiles;

/** Runs ES module code in the consumer project and returns what it printed as JSON. */
const run = (code) =>
  JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", code], { cwd: project, encoding: "utf8" }));

before(() => {
  assert.ok(fs.existsSync(path.join(REPO_ROOT, "dist/index.js")), "No build found. Run: npm run build");

  project = fs.mkdtempSync(path.join(os.tmpdir(), "bn-package-"));
  const [packed] = JSON.parse(
    execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", project], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }),
  );
  packedFiles = packed.files.map((file) => file.path);

  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "consumer", private: true }));
  // without the optional dependencies of alasql (a react-native tree): nothing here needs them
  execFileSync(
    "npm",
    ["install", path.join(project, packed.filename), "--ignore-scripts", "--omit=optional", "--no-audit", "--no-fund"],
    { cwd: project, stdio: "pipe" },
  );
});

after(() => {
  if (project) fs.rmSync(project, { recursive: true, force: true });
});

test("the tarball has the entry points and the schemas, and no test helpers", () => {
  for (const file of [
    "dist/index.js",
    "dist/index.cjs.js",
    "dist/types/index.d.ts",
    "dist/schemas/theme.schema.json",
    "loader/index.js",
    "loader/index.d.ts",
  ]) {
    assert.ok(packedFiles.includes(file), `missing in the tarball: ${file}`);
  }
  assert.deepEqual(
    packedFiles.filter((file) => file.includes("utils/testing") || file.includes(".spec.")),
    [],
  );
});

test("the main entry exports LAYOUT_STATE_VERSION for import and for require", () => {
  const [esm, cjs] = run(`
    import { createRequire } from "node:module";
    const esm = await import("${NAME}");
    const cjs = createRequire(import.meta.url)("${NAME}");
    console.log(JSON.stringify([esm.LAYOUT_STATE_VERSION, cjs.LAYOUT_STATE_VERSION]));
  `);

  assert.equal(esm, 1);
  assert.equal(cjs, 1);
});

test("the loader entry exports defineCustomElements for import and for require", () => {
  const types = run(`
    import { createRequire } from "node:module";
    const esm = await import("${NAME}/loader");
    const cjs = createRequire(import.meta.url)("${NAME}/loader");
    console.log(JSON.stringify([typeof esm.defineCustomElements, typeof cjs.defineCustomElements]));
  `);

  assert.deepEqual(types, ["function", "function"]);
});

test("a schema and package.json can be required", () => {
  const [schema, name] = run(`
    import { createRequire } from "node:module";
    const require = createRequire(import.meta.url);
    console.log(JSON.stringify([
      require("${NAME}/schemas/theme.schema.json").$schema,
      require("${NAME}/package.json").name,
    ]));
  `);

  assert.equal(schema, "http://json-schema.org/draft-07/schema#");
  assert.equal(name, NAME);
});

test("Node gets the CommonJS build of both entries, also for import", () => {
  // dist/index.js and loader/index.js use ES module syntax in a package without "type": "module".
  // Only a Node that detects the syntax can load them, so the "node" condition must win.
  const resolved = run(`
    console.log(JSON.stringify([import.meta.resolve("${NAME}"), import.meta.resolve("${NAME}/loader")]));
  `);

  assert.match(resolved[0], /\/dist\/index\.cjs\.js$/);
  assert.match(resolved[1], /\/loader\/index\.cjs\.js$/);
});

test("a path that is not an entry point does not resolve", () => {
  // dist/components is in the package, but its elements do not render: it is not offered as an entry
  const resolved = run(`
    const tryResolve = (specifier) => { try { return import.meta.resolve(specifier); } catch { return null; } };
    console.log(JSON.stringify([
      tryResolve("${NAME}/components/bn-table"),
      tryResolve("${NAME}/dist/components/bn-table.js"),
    ]));
  `);

  assert.deepEqual(resolved, [null, null]);
});

test("a strict TypeScript consumer compiles against the published types", () => {
  fs.writeFileSync(
    path.join(project, "consumer.ts"),
    `import { LAYOUT_STATE_VERSION, type LayoutState, type Components } from "${NAME}";
import { defineCustomElements } from "${NAME}/loader";

const version: number = LAYOUT_STATE_VERSION;
const bullet = document.createElement("bn-chart-bullet");
bullet.normalizeMode = "none";
bullet.normalize();
const grouped: Components.BnTable["grouped"] = true;
export const state: LayoutState | undefined = undefined;
defineCustomElements();
console.log(version, grouped);
`,
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        module: "esnext",
        moduleResolution: "bundler",
        target: "es2022",
        lib: ["dom", "es2022"],
        types: [],
        // the default of TypeScript 6 and newer
        noUncheckedSideEffectImports: true,
      },
      files: ["consumer.ts"],
    }),
  );

  let output = "";
  try {
    execFileSync(process.execPath, [path.join(REPO_ROOT, "node_modules/typescript/bin/tsc"), "-p", project], {
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    output = `${error.stdout}${error.stderr}`;
  }
  assert.equal(output, "");
});
