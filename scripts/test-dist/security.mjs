/**
 * Security checks against the built package in a real Chrome.
 *
 * Spec tests run under mock-doc, which never fires an event handler, loads a
 * resource or parses CSS. Whether a payload runs can only be seen in a browser.
 *
 * Usage: npm run build && npm run test:dist
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_ROOT = path.join(REPO_ROOT, "dist");
const ENTRY = "/bn-template-engine/bn-template-engine.esm.js";

const SET_GLOBAL = "window.__pwned=1";
const GROUPS = ["Men's Wear", "Côte d'Ivoire", `x' OR \`\`${SET_GLOBAL}\`\` OR 'x`];
const CATEGORIES = ["Shirts", `<img src=x onerror=${SET_GLOBAL}>`];
const SALES = GROUPS.flatMap((rowGroup, group) =>
  CATEGORIES.map((category, index) => ({
    rowGroup,
    rowGroupIndex: group + 1,
    category,
    categoryIndex: index + 1,
    subCategory: "",
    subCategoryIndex: 1,
    operation: "+",
    setname: "de",
    ac1: 10 * (group + 1) + index,
  })),
);
const REMOTE = [{ category: "remote" }];

const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const source = (name, rows) => `<bn-datasource name="${name}">${esc(JSON.stringify(rows))}</bn-datasource>`;
const sales = (sql = "SELECT * FROM sales_src") =>
  source("sales_src", SALES) + `<bn-dataset name="sales" datasources="sales_src">${esc(sql)}</bn-dataset>`;
const pwned = (page) => page.evaluate(() => window.__pwned);

/** Test pages by URL path. */
const pages = new Map();
/** Every path the server was asked for. */
const requested = [];
let server;
let browser;
let origin;

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
          `<body><bn-context locale="en">${page.body}</bn-context></body></html>`,
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
async function until(page, predicate) {
  const deadline = Date.now() + 30000;
  while (!(await page.evaluate(predicate))) {
    assert.ok(Date.now() < deadline, `timed out waiting for ${predicate}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Resolves after one more failed image load, so error events of injected elements had time to fire. */
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const img = new Image();
        img.onerror = () => resolve();
        img.src = "/missing";
      }),
  );

async function open(body, headers = {}) {
  const url = `/page-${pages.size}`;
  pages.set(url, { body, headers });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  const response = await page.goto(origin + url, { waitUntil: "load" });
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

const containerText = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("bn-text")].map((el) => el.shadowRoot.querySelector(".container").textContent),
  );

test("bn-text: a template is text, never code", async () => {
  const values = [
    "${t['constr'+'uctor']('return this')().__pwned=1}",
    "${(function(){return this})().__pwned=1}",
    "C:\\users\\report",
    "a `b` c",
  ];
  const { page } = await open(values.map((value) => `<bn-text value="${esc(value)}"></bn-text>`).join(""));
  assert.deepEqual(await containerText(page), values);
  assert.equal(await pwned(page), undefined);
});

test("bn-text: a row value is text, not markup", async () => {
  const label = `<b>x</b><img src=x onerror=${SET_GLOBAL}>`;
  const { page } = await open(
    source("kpi", [{ label, width: "1 class=injected" }]) +
      `<bn-text datasets="$kpi" value="${esc("<i>${data['$kpi'][0].label}</i>")}"></bn-text>` +
      `<bn-text datasets="$kpi" value="${esc("<span title=${data['$kpi'][0].width}>t</span>")}"></bn-text>`,
  );
  await until(page, () => document.querySelector("bn-text").shadowRoot.querySelector(".container").textContent !== "");
  await settle(page);
  const result = await page.evaluate(() => {
    const [first, second] = [...document.querySelectorAll("bn-text")].map((el) =>
      el.shadowRoot.querySelector(".container"),
    );
    return {
      text: first.textContent,
      fromData: first.querySelectorAll("b, img").length,
      fromAuthor: first.querySelectorAll("i").length,
      title: second.querySelector("span")?.getAttribute("title"),
      injected: second.querySelectorAll(".injected").length,
    };
  });
  assert.deepEqual(result, { text: label, fromData: 0, fromAuthor: 1, title: "1 class=injected", injected: 0 });
  assert.equal(await pwned(page), undefined);
});

test("sanitizeHtml: no handler runs, no payload element survives", async () => {
  const payloads = [
    `<font><img src=x onerror=${SET_GLOBAL}></font>`,
    `<audio src=x onerror=${SET_GLOBAL}></audio>`,
    `<details open ontoggle=${SET_GLOBAL}>x</details>`,
    `<svg><image href=x onerror=${SET_GLOBAL}></image></svg>`,
    `<a href="java&#x09;script:${SET_GLOBAL}">x</a>`,
    // a control named "tagName" shadows that property on its form
    `<form><input name="tagName"></form>`,
  ];
  // The marker proves the text was rendered at all.
  const { page } = await open(
    payloads
      .map(
        (p) =>
          `<bn-message text="${esc(p + "<b>ok</b>")}"></bn-message><bn-text value="${esc(p + "<b>ok</b>")}"></bn-text>`,
      )
      .join(""),
  );
  const result = await page.evaluate(() =>
    [...document.querySelectorAll("bn-message, bn-text")].map((host) => {
      host.shadowRoot.querySelectorAll("a").forEach((a) => a.click());
      return {
        marker: host.shadowRoot.querySelectorAll("b").length,
        survivors: [
          ...host.shadowRoot.querySelectorAll("font, audio, details, svg, image, form, input, a[href], img[onerror]"),
        ].map((el) => el.outerHTML),
      };
    }),
  );
  await settle(page);
  assert.equal(result.length, payloads.length * 2);
  for (const host of result) {
    assert.deepEqual(host, { marker: 1, survivors: [] });
  }
  assert.equal(await pwned(page), undefined);
});

const tableRendered = () =>
  !!document.querySelector("bn-table").shadowRoot.querySelector("ibcs-table")?.shadowRoot?.querySelector("tbody tr");

const chartRendered = () =>
  !!document
    .querySelector("bn-chart-structure")
    .shadowRoot.querySelector("ibcs-chart-structure")
    ?.shadowRoot?.querySelector("svg text");

test("bn-table: row groups with quotes and backticks all render and add up", async () => {
  const { page } = await open(
    sales() +
      `<bn-table datasets="sales" scenarios="ac1" grouped="true" show-group-title="true" type="sum"></bn-table>` +
      `<bn-chart-structure datasets="sales" scenarios="ac1"></bn-chart-structure>`,
  );
  await until(page, tableRendered);
  await until(page, chartRendered);
  await settle(page);
  const state = await page.evaluate(() => document.querySelector("bn-table").getLayoutState({ detail: "full" }));
  const cell = (row, key) =>
    state.elements.find((e) => e.kind === "cell" && e.row === row.index && e.key === key)?.value;
  const body = state.table.rows.filter((row) => row.section === "body");
  const sums = body.filter((row) => row.type === "SUM");
  const groupSums = sums.filter((row) => GROUPS.includes(cell(row, "category")));
  const totals = sums.filter((row) => !groupSums.includes(row));

  assert.deepEqual(groupSums.map((row) => cell(row, "category")).sort(), [...GROUPS].sort());
  assert.equal(totals.length, 1);
  assert.equal(
    groupSums.reduce((sum, row) => sum + cell(row, "ac1"), 0),
    cell(totals[0], "ac1"),
  );
  assert.equal(
    cell(totals[0], "ac1"),
    SALES.reduce((sum, row) => sum + row.ac1, 0),
  );

  // A category that looks like markup is text, in the table and in the chart.
  const markup = await page.evaluate(() =>
    [
      document.querySelector("bn-table").shadowRoot.querySelector("ibcs-table").shadowRoot,
      document.querySelector("bn-chart-structure").shadowRoot.querySelector("ibcs-chart-structure").shadowRoot,
    ].map((root) => ({ images: root.querySelectorAll("img").length, text: root.textContent })),
  );
  for (const root of markup) {
    assert.equal(root.images, 0);
    assert.ok(root.text.includes(CATEGORIES[1]), root.text);
  }
  assert.equal(await pwned(page), undefined);
});

const FILTER_HOSTS = [
  "bn-table",
  "bn-chart-time",
  "bn-chart-structure",
  "bn-chart-bullet",
  "bn-chart-scatter",
  "bn-chart-bubble",
];

test("filter: double backticks are rejected by the table and the charts", async () => {
  // The second one has no double backtick until AlaSQL strips the comments.
  const filters = [`1 = \`\`${SET_GLOBAL}\`\``, `1 = \`/**/\`${SET_GLOBAL}\`/**/\``];
  const { page } = await open(
    sales() +
      FILTER_HOSTS.flatMap((tag) =>
        filters.map((f) => `<${tag} datasets="sales" scenarios="ac1" filter="${esc(f)}"></${tag}>`),
      ).join(""),
  );
  const errors = await page.$$eval(FILTER_HOSTS.join(","), (els) =>
    els.map((el) => JSON.parse(el.getAttribute("has-error") ?? "[]")),
  );
  assert.equal(errors.length, FILTER_HOSTS.length * filters.length);
  for (const items of errors) {
    assert.ok(
      items.some((item) => item.id === "ERR_filter" && item.type === "error"),
      JSON.stringify(items),
    );
  }
  assert.equal(await pwned(page), undefined);
});

test("layout attributes: a value cannot leave its rule", async () => {
  const values = [
    "10px;} body{display:none",
    'var(--w,"',
    "var(--w,</style><img src=x onerror=window.__pwned=1>)",
    "var(--w)/*",
    "10px !important",
  ];
  const { page } = await open(
    values.map((value) => `<bn-text value="x" width="${esc(value)}"></bn-text>`).join("") +
      `<bn-text value="x" width="200" grid-column="1/span 2"></bn-text>`,
  );
  const result = await page.evaluate(() => ({
    bodyDisplay: getComputedStyle(document.body).display,
    images: document.querySelectorAll("img").length,
    rules: [...document.querySelector("style[data-bn-computed-style]").sheet.cssRules].map((rule) => rule.cssText),
  }));
  assert.notEqual(result.bodyDisplay, "none");
  assert.equal(result.images, 0);
  // The two valid values of the last element are left, and the fourth value as the browser closed it.
  assert.deepEqual(result.rules.map((rule) => rule.replace(/^\.bn-c-\w+ /, "")).sort(), [
    "{ grid-column: 1 / span 2; }",
    "{ width: 200px; }",
    "{ width: var(--w); }",
  ]);
  assert.equal(await pwned(page), undefined);
});

test("bn-dataset: the body is SQL, only src is fetched", async () => {
  const { page } = await open(
    sales("/* c */ SELECT * FROM sales_src") +
      `<bn-dataset name="remote" src="/rows.json"></bn-dataset>` +
      `<bn-text datasets="sales,remote" value="${esc("${data.sales[0].category}|${data.remote[0].category}")}"></bn-text>`,
  );
  await until(
    page,
    () => document.querySelector("bn-text").shadowRoot.querySelector(".container").textContent === "Shirts|remote",
  );
  assert.ok(requested.includes("/rows.json"));
  assert.ok(!requested.some((urlPath) => urlPath.includes("SELECT")));
});

test("the policy in SECURITY.md is enough to render", async () => {
  const match = /Content-Security-Policy: (.+)/.exec(fs.readFileSync(path.join(REPO_ROOT, "SECURITY.md"), "utf8"));
  assert.ok(match, "SECURITY.md has no Content-Security-Policy line");
  const { page, response } = await open(
    sales() + `<bn-table datasets="sales" scenarios="ac1" width="600"></bn-table>`,
    { "Content-Security-Policy": match[1] },
  );
  assert.equal(response.headers()["content-security-policy"], match[1]);
  await until(page, tableRendered);
  const result = await page.evaluate(() => ({
    violations: window.__csp,
    rules: document.querySelector("style[data-bn-computed-style]").sheet?.cssRules.length,
  }));
  assert.deepEqual(result, { violations: [], rules: 1 });
});
