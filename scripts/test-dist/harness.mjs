/**
 * Shared setup of the checks against the built package in a real Chrome:
 * a local server for dist/ and for test pages, and one browser per test file.
 *
 * Importing this module registers the before/after hooks of the test file.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_ROOT = path.join(REPO_ROOT, "dist");
const ENTRY = "/bn-template-engine/bn-template-engine.esm.js";

/** Served as /rows.json. */
const REMOTE = [{ category: "remote" }];

/** Test pages by URL path. */
const pages = new Map();
/** Every path the server was asked for. */
export const requested = [];
let server;
let browser;
let origin;

export const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

before(async () => {
  assert.ok(fs.existsSync(path.join(DIST_ROOT, ENTRY)), "No build found. Run: npm run build");

  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    requested.push(urlPath);
    const page = pages.get(urlPath);
    if (page) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...page.headers });
      res.end(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><script type="module" src="${ENTRY}"></script></head>` +
          `<body><bn-context locale="en" ${page.contextAttrs}>${page.body}</bn-context></body></html>`,
      );
      return;
    }
    if (urlPath === "/rows.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(REMOTE));
      return;
    }
    const filePath = path.join(DIST_ROOT, urlPath);
    // Refuse to serve outside the root.
    if (!filePath.startsWith(DIST_ROOT)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      res.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;

  // Where Chrome's sandbox is not available, set PUPPETEER_DANGEROUS_NO_SANDBOX=true.
  browser = await puppeteer.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

/** Polls with page.evaluate, which needs no eval inside the page and so also works under the CSP. */
export async function until(page, predicate) {
  const deadline = Date.now() + 30000;
  while (!(await page.evaluate(predicate))) {
    assert.ok(Date.now() < deadline, `timed out waiting for ${predicate}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Resolves after one more failed image load, so error events of injected elements had time to fire. */
export const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const img = new Image();
        img.onerror = () => resolve();
        img.src = "/missing";
      }),
  );

/** Loads `body` inside a bn-context and returns as soon as the document has loaded. */
export async function load(body, headers = {}, contextAttrs = "") {
  const url = `/page-${pages.size}`;
  pages.set(url, { body, headers, contextAttrs });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  const response = await page.goto(origin + url, { waitUntil: "load" });
  return { page, response };
}

/** Loads `body` inside a bn-context and waits until every component has rendered. */
export async function open(body, headers = {}, contextAttrs = "") {
  const { page, response } = await load(body, headers, contextAttrs);
  // componentRegisterIsRenderedResult is never reset, so also require every component to have rendered once.
  await until(page, () => {
    const failures = window.componentRegisterFailures ?? [];
    // a failed component stays failed: stop here instead of waiting for the timeout
    if (failures.length > 0) throw new Error(`components failed: ${JSON.stringify(failures)}`);
    return (
      window.componentRegisterIsRenderedResult === true &&
      [...document.querySelectorAll("bn-context > *")].every((el) => el.classList.contains("hydrated"))
    );
  });
  await settle(page);
  return { page, response };
}
