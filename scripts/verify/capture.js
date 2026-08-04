/**
 * Byte-identity capture harness for render-loop performance work.
 *
 * Loads the www/ build in a real Chrome (via puppeteer), waits for the page to
 * fully settle, and writes a canonical serialization of every rendered
 * component. Two builds captured this way can be compared with diff.js to prove
 * a refactor changed no rendered output.
 *
 * Determinism is the whole point, so this script:
 *  - aborts Google Fonts requests (the network race is the single biggest
 *    nondeterminism source: calculate-size permanently caches the first
 *    measurement of every string, so a late font swap freezes the wrong metrics)
 *  - disables background/timer throttling and keeps the page fronted, because
 *    Stencil re-renders do not settle under rAF suppression
 *  - waits past settleParentHeight's last 2500ms tick before capturing
 *
 * Usage:
 *   node scripts/verify/capture.js --out <dir> [--runs 5] [--label baseline]
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const puppeteer = require("puppeteer");

const REPO_ROOT = path.resolve(__dirname, "../..");
const WWW_ROOT = path.join(REPO_ROOT, "www");

const VIEWPORT = { width: 1440, height: 2000, deviceScaleFactor: 1 };

/** settleParentHeight's last tick is at 2500ms; wait past it before capturing. */
const MIN_SETTLE_MS = 4000;
/** Required window of DOM silence before the page counts as settled. */
const QUIET_MS = 750;
const SETTLE_TIMEOUT_MS = 30000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
};

function startServer(root) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const rel = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.join(root, rel);

    // Refuse to serve outside the root.
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/**
 * Serializes a DOM subtree canonically, crossing shadow boundaries.
 *
 * Runs inside the page. Every component in this library is `shadow: true`, so a
 * plain outerHTML capture would return nothing meaningful.
 *
 * Excludes Stencil's build-derived bookkeeping (s-id / c-id / sty-id /
 * class="hydrated") and injected <style> blocks, whose scoping hashes change
 * with any code edit. Numbers are never rounded — rounding would forfeit the
 * byte-identity claim.
 */
const SERIALIZER = `
function canonicalize(root) {
  const SKIP_ATTRS = new Set(["s-id", "c-id", "sty-id"]);
  const out = [];

  function attrsOf(el) {
    return Array.from(el.attributes)
      .filter((a) => !SKIP_ATTRS.has(a.name) && !a.name.startsWith("s-"))
      .map((a) => {
        if (a.name !== "class") return [a.name, a.value];
        const cleaned = a.value.split(/\\s+/).filter((c) => c && c !== "hydrated").sort().join(" ");
        return cleaned ? ["class", cleaned] : null;
      })
      .filter(Boolean)
      .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
      .map(([n, v]) => n + '="' + v + '"')
      .join(" ");
  }

  function walk(node, depth) {
    const pad = "  ".repeat(depth);

    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.nodeValue.trim();
      if (t) out.push(pad + "#text " + t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    if (tag === "style" || tag === "script") return;

    const a = attrsOf(node);
    out.push(pad + "<" + tag + (a ? " " + a : "") + ">");

    if (node.shadowRoot) {
      out.push(pad + "  #shadow-root");
      for (const c of node.shadowRoot.childNodes) walk(c, depth + 2);
    }
    for (const c of node.childNodes) walk(c, depth + 1);
  }

  walk(root, 0);
  return out.join("\\n");
}
`;

async function capture(page, outDir) {
  fs.mkdirSync(path.join(outDir, "components"), { recursive: true });

  const result = await page.evaluate(
    `(() => {
      ${SERIALIZER}

      // Collect every bn-*/ibcs-* host in document order, crossing shadow roots.
      const hosts = [];
      (function collect(root) {
        const els = root.querySelectorAll("*");
        for (const el of els) {
          const t = el.tagName.toLowerCase();
          if (t.startsWith("bn-") || t.startsWith("ibcs-")) hosts.push(el);
          if (el.shadowRoot) collect(el.shadowRoot);
        }
      })(document);

      const seen = {};
      const components = {};
      for (const el of hosts) {
        const t = el.tagName.toLowerCase();
        seen[t] = (seen[t] || 0) + 1;
        // Only the inner renderers get their own file: they are where the
        // refactors land, and per-component files localize a diff.
        if (t.startsWith("ibcs-")) {
          components[t + "[" + (seen[t] - 1) + "]"] = canonicalize(el);
        }
      }

      const ctx = document.querySelector("bn-context");
      return {
        page: ctx ? canonicalize(ctx) : "",
        components,
        hostCounts: seen,
      };
    })()`,
  );

  // Structured geometry snapshot from the library's own API.
  let layout = null;
  try {
    layout = await page.evaluate(async () => {
      const ctx = document.querySelector("bn-context");
      if (!ctx || typeof ctx.getLayoutState !== "function") return null;
      const s = await ctx.getLayoutState({ detail: "full" });
      // The only clock value that reaches a capture.
      delete s.generatedAt;
      return s;
    });
  } catch (e) {
    layout = { error: String(e) };
  }

  fs.writeFileSync(path.join(outDir, "page.txt"), result.page);
  for (const [id, text] of Object.entries(result.components)) {
    fs.writeFileSync(path.join(outDir, "components", id.replace(/[[\]]/g, "_") + ".txt"), text);
  }
  if (layout) {
    fs.writeFileSync(path.join(outDir, "layout.json"), JSON.stringify(layout, null, 2));
  }

  // Tripwires: assumptions that must stay true for the capture to be meaningful.
  const warnings = [];
  const all = result.page + Object.values(result.components).join("");
  // A component that rendered before its dataset resolved falls back to the
  // no-data branch. That is a degraded run, not a real output change — surface
  // it rather than letting it masquerade as a diff.
  const noData = (result.page.match(/class="warning"/g) || []).length;
  if (noData > 0) {
    warnings.push(`${noData} component(s) rendered the no-data branch — likely a degraded run, re-capture before trusting a diff`);
  }
  if (/Svgjs[A-Z]/.test(all)) {
    warnings.push("svg.js auto-generated ids present — the global id counter is now observable");
  }
  // Literal error ids (ERR_/AUTO_/WARN_/INFO_) can hit 21 chars by coincidence,
  // so exclude them rather than flagging every long id.
  if (/"id":"(?!ERR_|AUTO_|WARN_|INFO_)[A-Za-z0-9_-]{21}"/.test(all)) {
    warnings.push("nanoid-shaped id present — withHasError is minting ids into the DOM");
  }

  return { componentCount: Object.keys(result.components).length, hostCounts: result.hostCounts, warnings };
}

async function waitForSettle(page) {
  await page.evaluate(
    ({ quietMs }) => {
      window.__lastMutation = Date.now();
      const obs = new MutationObserver(() => {
        window.__lastMutation = Date.now();
      });
      const opts = { childList: true, subtree: true, attributes: true, characterData: true };
      obs.observe(document.documentElement, opts);

      // Shadow roots do not bubble mutations to the host's observer.
      (function observeShadows(root) {
        for (const el of root.querySelectorAll("*")) {
          if (el.shadowRoot) {
            obs.observe(el.shadowRoot, opts);
            observeShadows(el.shadowRoot);
          }
        }
      })(document);

      window.__quietMs = quietMs;
    },
    { quietMs: QUIET_MS },
  );

  const start = Date.now();
  for (;;) {
    const state = await page.evaluate(() => ({
      rendered: window.componentRegisterIsRenderedResult === true,
      sinceMutation: Date.now() - (window.__lastMutation || 0),
    }));

    const elapsed = Date.now() - start;
    if (state.rendered && elapsed >= MIN_SETTLE_MS && state.sinceMutation >= QUIET_MS) {
      return { elapsed, ok: true };
    }
    if (elapsed > SETTLE_TIMEOUT_MS) {
      return { elapsed, ok: false, state };
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const argOf = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };

  const outRoot = path.resolve(argOf("--out", path.join(REPO_ROOT, ".verify", "capture")));
  const runs = parseInt(argOf("--runs", "1"), 10);
  const label = argOf("--label", "unlabeled");

  if (!fs.existsSync(path.join(WWW_ROOT, "index.html"))) {
    console.error(`No build found at ${WWW_ROOT}. Run: npx stencil build`);
    process.exit(1);
  }

  const { server, port } = await startServer(WWW_ROOT);
  const url = `http://127.0.0.1:${port}/index.html`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--force-device-scale-factor=1",
      "--font-render-hinting=none",
      "--hide-scrollbars",
    ],
  });

  const summaries = [];
  try {
    // Throwaway load first. The very first navigation after a build pays cold
    // HTTP and module-compile costs, and that has been observed to let charts
    // render before their datasets resolve — which shows up as a spurious diff
    // in run 1 only. Warming up keeps every measured run on equal footing.
    const warm = await browser.newPage();
    await warm.setViewport(VIEWPORT);
    await warm.goto(url, { waitUntil: "load", timeout: 60000 });
    await new Promise((r) => setTimeout(r, MIN_SETTLE_MS));
    await warm.close();

    for (let run = 1; run <= runs; run++) {
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);

      // Kill the font network race entirely.
      await page.setRequestInterception(true);
      let fontsBlocked = 0;
      page.on("request", (req) => {
        const u = req.url();
        if (u.includes("fonts.googleapis.com") || u.includes("fonts.gstatic.com")) {
          fontsBlocked++;
          req.abort();
          return;
        }
        req.continue();
      });

      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));

      // Attribute forced layouts to their cause, without touching source.
      // Both offenders go through DOM APIs we can wrap before the bundle loads:
      // calculate-size appends a probe div to <body> and reads offsetWidth,
      // and svg.js's bbox() retry clones a subtree into the document to call
      // getBBox() on it.
      await page.evaluateOnNewDocument(() => {
        window.__probe = { offsetReads: 0, getBBox: 0, bodyAppends: 0, dbExec: 0 };

        const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
          get() {
            window.__probe.offsetReads++;
            return offsetWidth.get.call(this);
          },
          configurable: true,
        });

        if (window.SVGGraphicsElement) {
          const gbb = SVGGraphicsElement.prototype.getBBox;
          window.__probe.getBBoxByCaller = {};
          window.__probe.getBBoxDetached = 0;
          SVGGraphicsElement.prototype.getBBox = function (...a) {
            window.__probe.getBBox++;
            if (!this.isConnected) window.__probe.getBBoxDetached++;
            // Attribute each call to the nearest frame outside svg.js.
            const frames = (new Error().stack || "").split("\n").slice(2, 12);
            const site =
              frames.find((f) => !/svg\.js|svg\.esm|getBBox/.test(f) && /https?:\/\//.test(f)) || "unknown";
            const key = site.trim().replace(/^at\s+/, "").slice(0, 90);
            window.__probe.getBBoxByCaller[key] = (window.__probe.getBBoxByCaller[key] || 0) + 1;
            return gbb.apply(this, a);
          };
        }

        const append = Node.prototype.appendChild;
        Node.prototype.appendChild = function (child) {
          if (this === document.body) window.__probe.bodyAppends++;
          return append.call(this, child);
        };
      });

      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await page.bringToFront();

      const settle = await waitForSettle(page);
      const outDir = path.join(outRoot, `run${run}`);
      const captured = await capture(page, outDir);

      // Chrome's own accounting — no source instrumentation, so it reads the
      // same way on any code state. ScriptDuration is the number that moves
      // when redundant work is removed; settleMs cannot show it because it is
      // dominated by the fixed MIN_SETTLE_MS floor.
      const m = await page.metrics();
      const probe = await page.evaluate(() => ({
        ...(window.__probe || {}),
        draws: window.__probeDraw || null,
        solverIterations: window.__probeIter || null,
      }));
      const perf = {
        probe,
        scriptDurationMs: Math.round(m.ScriptDuration * 1000),
        taskDurationMs: Math.round(m.TaskDuration * 1000),
        layoutDurationMs: Math.round(m.LayoutDuration * 1000),
        recalcStyleDurationMs: Math.round(m.RecalcStyleDuration * 1000),
        layoutCount: m.LayoutCount,
        recalcStyleCount: m.RecalcStyleCount,
      };

      fs.writeFileSync(
        path.join(outDir, "manifest.json"),
        JSON.stringify(
          {
            label,
            run,
            gitSha: execSync("git rev-parse HEAD", { cwd: REPO_ROOT }).toString().trim(),
            gitDirty: execSync("git status --porcelain", { cwd: REPO_ROOT }).toString().trim().length > 0,
            chrome: await browser.version(),
            puppeteer: require("puppeteer/package.json").version,
            viewport: VIEWPORT,
            fontsBlocked,
            settleMs: settle.elapsed,
            settleOk: settle.ok,
            pageErrors,
            perf,
            ...captured,
          },
          null,
          2,
        ),
      );

      summaries.push({ run, ...captured, settle, pageErrors: pageErrors.length });
      console.log(
        `run${run}: ${captured.componentCount} components, settled in ${settle.elapsed}ms` +
          `${settle.ok ? "" : " [SETTLE TIMEOUT]"}${pageErrors.length ? ` [${pageErrors.length} page errors]` : ""}` +
          `${captured.warnings.length ? ` [${captured.warnings.join("; ")}]` : ""}`,
      );

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nWrote ${runs} run(s) to ${outRoot}`);
  const counts = new Set(summaries.map((s) => s.componentCount));
  if (counts.size > 1) {
    console.error(`WARNING: component count varied across runs: ${[...counts].join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
