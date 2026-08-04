/**
 * Compares two capture directories produced by capture.js.
 *
 * Used two ways:
 *  - flake floor: diff run1..runN of the SAME build. Any difference is
 *    nondeterminism, and until it is zero the harness proves nothing.
 *  - acceptance: diff a baseline capture against a candidate capture. Any
 *    difference is a rendered-output change, which this refactor does not allow.
 *
 * Usage:
 *   node scripts/verify/diff.js <dirA> <dirB>
 *   node scripts/verify/diff.js --flake <captureRoot>     # compares run1 vs run2..N
 */

const fs = require("fs");
const path = require("path");

/** Files whose contents legitimately differ between builds and carry no rendered output. */
const IGNORED = new Set(["manifest.json"]);

function listFiles(dir) {
  const out = [];
  (function walk(d, rel) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) walk(path.join(d, entry.name), relPath);
      else if (!IGNORED.has(relPath)) out.push(relPath);
    }
  })(dir, "");
  return out.sort();
}

/** Returns the 1-indexed line and column of the first byte that differs. */
function firstDivergence(a, b) {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i++;
  const upTo = a.slice(0, i);
  const line = upTo.split("\n").length;
  const col = i - (upTo.lastIndexOf("\n") + 1) + 1;
  const excerpt = (s) => s.slice(i, i + 120).split("\n")[0];
  return { line, col, a: excerpt(a), b: excerpt(b) };
}

function compare(dirA, dirB, nameA, nameB) {
  const filesA = listFiles(dirA);
  const filesB = listFiles(dirB);
  const setA = new Set(filesA);
  const setB = new Set(filesB);

  const onlyA = filesA.filter((f) => !setB.has(f));
  const onlyB = filesB.filter((f) => !setA.has(f));
  const shared = filesA.filter((f) => setB.has(f));

  const changed = [];
  for (const f of shared) {
    const a = fs.readFileSync(path.join(dirA, f), "utf8");
    const b = fs.readFileSync(path.join(dirB, f), "utf8");
    if (a !== b) changed.push({ file: f, ...firstDivergence(a, b) });
  }

  const clean = onlyA.length === 0 && onlyB.length === 0 && changed.length === 0;

  console.log(`\n${nameA} vs ${nameB}`);
  console.log(`  ${shared.length} files compared`);
  if (clean) {
    console.log("  IDENTICAL");
    return true;
  }

  if (onlyA.length) console.log(`  only in ${nameA}: ${onlyA.join(", ")}`);
  if (onlyB.length) console.log(`  only in ${nameB}: ${onlyB.join(", ")}`);
  for (const c of changed) {
    console.log(`  DIFF ${c.file} (line ${c.line}, col ${c.col})`);
    console.log(`    ${nameA}: ${c.a}`);
    console.log(`    ${nameB}: ${c.b}`);
  }
  console.log(`  ${changed.length} file(s) differ`);
  return false;
}

function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--flake") {
    const root = path.resolve(args[1]);
    const runs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^run\d+$/.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10));

    if (runs.length < 2) {
      console.error(`Need at least 2 runs in ${root}, found ${runs.length}`);
      process.exit(1);
    }

    let allClean = true;
    for (let i = 1; i < runs.length; i++) {
      const ok = compare(path.join(root, runs[0]), path.join(root, runs[i]), runs[0], runs[i]);
      allClean = allClean && ok;
    }
    console.log(
      allClean
        ? `\nFLAKE FLOOR CLEAN — ${runs.length} runs byte-identical. The harness can prove things.`
        : `\nFLAKE FLOOR DIRTY — output is nondeterministic. Fix this before trusting any comparison.`,
    );
    process.exit(allClean ? 0 : 1);
  }

  if (args.length < 2) {
    console.error("Usage: diff.js <dirA> <dirB>   |   diff.js --flake <captureRoot>");
    process.exit(1);
  }

  const ok = compare(path.resolve(args[0]), path.resolve(args[1]), args[0], args[1]);
  process.exit(ok ? 0 : 1);
}

main();
