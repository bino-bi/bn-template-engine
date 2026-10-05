/**
 * Page, layout and readiness checks against the built package in a real Chrome.
 *
 * Spec tests run under mock-doc, which has no layout, no print and no CSS
 * cascade. Page sizes, the number of printed pages and the behaviour of a
 * component that throws can only be seen in a browser.
 *
 * Usage: npm run build && npm run test:dist
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { esc, load, open, until } from "./harness.mjs";

const PX_PER_INCH = 96;

/** [format, width, height] in CSS px, in the native orientation of the format. */
const FORMATS = [
  ["xga", 1024, 768],
  ["hd", 1280, 720],
  ["full-hd", 1920, 1080],
  ["4k", 3840, 2160],
  ["4k2k", 4096, 2160],
  ["a6", 4.13 * PX_PER_INCH, 5.83 * PX_PER_INCH],
  ["a5", 5.83 * PX_PER_INCH, 8.27 * PX_PER_INCH],
  ["a4", 8.27 * PX_PER_INCH, 11.69 * PX_PER_INCH],
  ["a3", 11.69 * PX_PER_INCH, 16.54 * PX_PER_INCH],
  ["a2", 16.54 * PX_PER_INCH, 23.39 * PX_PER_INCH],
  ["a1", 23.39 * PX_PER_INCH, 33.11 * PX_PER_INCH],
  ["a0", 33.11 * PX_PER_INCH, 46.81 * PX_PER_INCH],
  ["letter", 8.5 * PX_PER_INCH, 11 * PX_PER_INCH],
  ["legal", 8.5 * PX_PER_INCH, 14 * PX_PER_INCH],
  ["tabloid", 11 * PX_PER_INCH, 17 * PX_PER_INCH],
  ["ledger", 17 * PX_PER_INCH, 11 * PX_PER_INCH],
];

const rows = [
  {
    setname: "de",
    operation: "+",
    date: "2024-01-01",
    rowGroup: "Group",
    rowGroupIndex: 1,
    category: "Shirts",
    categoryIndex: 1,
    subCategory: "",
    subCategoryIndex: 1,
    ac1: 10,
    ac2: 20,
    ac3: 30,
    pl1: 12,
  },
];
const sales =
  `<bn-datasource name="sales_src">${esc(JSON.stringify(rows))}</bn-datasource>` +
  `<bn-dataset name="sales" datasources="sales_src">SELECT * FROM sales_src</bn-dataset>`;

// Chrome lays out in steps of 1/64 px
const close = (actual, expected) => Math.abs(actual - expected) < 0.02;

test("page formats: every format has its true size, in both orientations", async () => {
  const cases = FORMATS.flatMap(([format, width, height]) => {
    const native = width >= height ? "landscape" : "portrait";
    const other = native === "landscape" ? "portrait" : "landscape";
    return [
      { format, attrs: `format="${format}"`, width, height },
      { format, attrs: `format="${format}" orientation="${native}"`, width, height },
      { format, attrs: `format="${format}" orientation="${other}"`, width: height, height: width },
    ];
  });
  const { page } = await open(cases.map((c) => `<bn-page ${c.attrs}></bn-page>`).join(""));

  const sizes = await page.$$eval("bn-page", (els) =>
    els.map((el) => {
      const style = getComputedStyle(el);
      return { width: parseFloat(style.width), height: parseFloat(style.height) };
    }),
  );
  assert.equal(sizes.length, cases.length);
  cases.forEach((c, index) => {
    assert.ok(
      close(sizes[index].width, c.width) && close(sizes[index].height, c.height),
      `${c.attrs}: ${JSON.stringify(sizes[index])}, expected ${c.width} x ${c.height}`,
    );
  });
});

test("page formats: an unknown format keeps the default size and warns", async () => {
  const { page } = await open(`<bn-page format="full_hd"></bn-page>`);

  const result = await page.$eval("bn-page", (el) => ({
    width: getComputedStyle(el).width,
    height: getComputedStyle(el).height,
    ids: JSON.parse(el.getAttribute("has-error") ?? "[]").map((item) => item.id),
  }));
  assert.deepEqual(result, { width: "1024px", height: "768px", ids: ["ERR_format"] });
});

// A page fills the sheet exactly, so the document must not add a margin of its own.
const removeBodyMargin = (page) => page.addStyleTag({ content: "body { margin: 0; }" });

/** Page count and page boxes of a PDF that Chrome wrote. */
const pdfInfo = (pdf) => {
  const text = Buffer.from(pdf).toString("latin1");
  return {
    pages: (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    boxes: [...new Set(text.match(/\/MediaBox\s*\[[^\]]+\]/g) ?? [])],
  };
};

for (const [format, orientation, width, height] of [
  ["a4", "portrait", 8.27, 11.69],
  ["a4", "landscape", 11.69, 8.27],
  ["a3", "portrait", 11.69, 16.54],
  ["letter", "portrait", 8.5, 11],
  ["xga", "landscape", 1024 / PX_PER_INCH, 768 / PX_PER_INCH],
  ["full-hd", "landscape", 1920 / PX_PER_INCH, 1080 / PX_PER_INCH],
]) {
  test(`print: three ${format} ${orientation} pages are three sheets`, async () => {
    const layoutPage =
      `<bn-layout-page page-format="${format}" page-orientation="${orientation}">` +
      `<bn-text slot="slot-0" value="page"></bn-text></bn-layout-page>`;
    const { page } = await open(layoutPage.repeat(3));
    await removeBodyMargin(page);

    const rule = await page.$eval("style[data-bn-page-size]", (style) => style.textContent);
    assert.match(rule, /^@page \{ size: \S+ \S+; margin: 0; \}$/);

    // a caller that passes the paper size, and one that lets the page decide
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };
    const fixed = pdfInfo(await page.pdf({ width: `${width}in`, height: `${height}in`, margin }));
    const fromCss = pdfInfo(await page.pdf({ preferCSSPageSize: true }));

    assert.equal(fixed.pages, 3, `paper size passed in: ${JSON.stringify(fixed)}`);
    assert.equal(fromCss.pages, 3, `preferCSSPageSize: ${JSON.stringify(fromCss)}`);
    assert.equal(fromCss.boxes.length, 1, JSON.stringify(fromCss.boxes));
    // the sheet has the size of the page (PDF points, 72 per inch), not the letter default
    const [, , boxWidth, boxHeight] = fromCss.boxes[0].match(/[\d.]+/g).map(Number);
    assert.ok(Math.abs(boxWidth - width * 72) < 1 && Math.abs(boxHeight - height * 72) < 1, fromCss.boxes[0]);
  });
}

/** The page label a layout page prints in its footer. */
const footerLabels = (page) =>
  page.$$eval("bn-layout-page", (els) =>
    els.map((el) => el.shadowRoot.querySelector("bn-footer").shadowRoot.querySelector(".page")?.textContent ?? null),
  );

test("page numbers: a number of the author stays, the other pages are numbered by position", async () => {
  const { page } = await open(
    `<bn-layout-page></bn-layout-page>` +
      `<bn-layout-page page-number="A-1"></bn-layout-page>` +
      `<bn-layout-page page-number="7"></bn-layout-page>` +
      `<bn-layout-page></bn-layout-page>`,
  );

  assert.deepEqual(await footerLabels(page), ["1", "A-1", "7", "4"]);
  // the old code overwrote them 250 ms after the load
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.deepEqual(await footerLabels(page), ["1", "A-1", "7", "4"]);
});

test("page numbers: a page that is added later gets its number", async () => {
  const { page } = await open(`<bn-layout-page></bn-layout-page>`);

  await page.evaluate(() => {
    document.querySelector("bn-context").append(document.createElement("bn-layout-page"));
  });
  await until(page, () => document.querySelectorAll("bn-layout-page.hydrated").length === 2);
  await until(
    page,
    () =>
      document
        .querySelectorAll("bn-layout-page")[1]
        .shadowRoot.querySelector("bn-footer")
        .shadowRoot?.querySelector(".page")?.textContent === "2",
  );
});

test("orientation: a portrait page in a landscape document is turned onto the sheet", async () => {
  const { page } = await open(
    `<bn-layout-page id="turned" page-format="a4" page-orientation="portrait"></bn-layout-page>` +
      `<bn-layout-page id="plain" page-format="a4" page-orientation="landscape"></bn-layout-page>`,
    {},
    `render-orientation="landscape"`,
  );
  await removeBodyMargin(page);

  const boxes = await page.$$eval("bn-layout-page", (els) =>
    els.map((el) => {
      const host = el.getBoundingClientRect();
      const inner = el.shadowRoot.querySelector("bn-page");
      const box = inner.getBoundingClientRect();
      return {
        id: el.id,
        host: [host.width, host.height],
        // where the rotated page ends up on screen
        page: [box.left - host.left, box.top - host.top, box.width, box.height],
        transform: inner.style.transform,
      };
    }),
  );
  const [sheetWidth, sheetHeight] = [11.69 * PX_PER_INCH, 8.27 * PX_PER_INCH];
  const [turned, plain] = boxes;
  // the turned host takes the size of the sheet. The plain one is a block as wide as the window.
  assert.ok(close(turned.host[0], sheetWidth) && close(turned.host[1], sheetHeight), JSON.stringify(turned));
  assert.notEqual(turned.transform, "");
  assert.equal(plain.transform, "");
  for (const box of boxes) {
    // on screen both pages cover a landscape sheet, from the top left corner of their host
    assert.ok(
      close(box.page[0], 0) &&
        close(box.page[1], 0) &&
        close(box.page[2], sheetWidth) &&
        close(box.page[3], sheetHeight),
      JSON.stringify(box),
    );
  }

  const pdf = pdfInfo(await page.pdf({ preferCSSPageSize: true }));
  assert.equal(pdf.pages, 2, JSON.stringify(pdf));
});

test("layout: 1-over-3 has three columns and uses the full width", async () => {
  const cells = (prefix) =>
    [0, 1, 2, 3].map((index) => `<bn-text slot="${prefix}${index}" value="${index}"></bn-text>`).join("");
  const { page } = await open(
    `<bn-layout-page page-layout="1-over-3">${cells("slot-")}</bn-layout-page>` +
      `<bn-layout-card card-layout="1-over-3">${cells("card-slot-")}</bn-layout-card>`,
  );

  const grids = await page.$$eval("bn-layout-page, bn-layout-card", (els) =>
    els.map((el) => {
      const grid = [...el.shadowRoot.querySelectorAll("div")].find((div) => getComputedStyle(div).display === "grid");
      return {
        tag: el.localName,
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        width: grid.getBoundingClientRect().width,
        firstCell: grid.firstElementChild.getBoundingClientRect().width,
      };
    }),
  );
  assert.equal(grids.length, 2);
  for (const grid of grids) {
    // a blank in the template used to add a fourth, empty column: the content took three quarters of the width
    assert.equal(grid.columns, 3, JSON.stringify(grid));
    assert.ok(close(grid.firstCell, grid.width), JSON.stringify(grid));
  }
});

test("layout: a custom template that is no template is one cell and a warning, not a failed page", async () => {
  const { page } = await open(
    `<bn-layout-page page-layout="custom-template" page-custom-template="a b"><bn-text slot="slot-0" value="x"></bn-text></bn-layout-page>`,
  );

  const result = await page.$eval("bn-layout-page", (el) => ({
    slots: el.shadowRoot.querySelectorAll("slot").length,
    items: JSON.parse(el.getAttribute("has-error") ?? "[]").map((item) => [item.id, item.type]),
  }));
  assert.deepEqual(result, { slots: 1, items: [["ERR_pageCustomTemplate", "warning"]] });
});

const DATA_HOSTS = [
  ["bn-table", `scenarios="ac1"`],
  ["bn-chart-time", `scenarios="ac1"`],
  ["bn-chart-structure", `scenarios="ac1"`],
  ["bn-chart-bullet", `actual="ac1" target="pl1"`],
  ["bn-chart-scatter", `x="ac1" y="ac2"`],
  ["bn-chart-bubble", `x="ac1" y="ac2" size="ac3"`],
];

test("failures: a filter AlaSQL cannot read is an ERR_sql item on the table and the charts", async () => {
  const { page } = await open(
    sales +
      DATA_HOSTS.map(([tag, attrs]) => `<${tag} datasets="sales" ${attrs} filter="category ="></${tag}>`).join(""),
  );

  const hosts = await page.$$eval(DATA_HOSTS.map(([tag]) => tag).join(","), (els) =>
    els.map((el) => ({
      tag: el.localName,
      items: JSON.parse(el.getAttribute("has-error") ?? "[]"),
      // "No Data" would hide that the query is wrong
      noData: [...el.shadowRoot.querySelectorAll("*")].some((inner) => inner.shadowRoot?.querySelector(".empty-state")),
    })),
  );
  assert.equal(hosts.length, DATA_HOSTS.length);
  for (const host of hosts) {
    assert.ok(
      host.items.some((item) => item.id === "ERR_sql" && item.type === "error"),
      JSON.stringify(host),
    );
    assert.equal(host.noData, false, host.tag);
  }
  // an ERR_sql item is not a failed component: the page counts as rendered
  assert.deepEqual(await page.evaluate(() => window.componentRegisterFailures), []);
});

test("failures: a working filter reports nothing", async () => {
  const { page } = await open(
    sales +
      DATA_HOSTS.map(([tag, attrs]) => `<${tag} datasets="sales" ${attrs} filter="category = 'Shirts'"></${tag}>`).join(
        "",
      ),
  );

  const ids = await page.$$eval(DATA_HOSTS.map(([tag]) => tag).join(","), (els) =>
    els.flatMap((el) => JSON.parse(el.getAttribute("has-error") ?? "[]").filter((item) => item.type === "error")),
  );
  assert.deepEqual(ids, []);
});

// "No rows" is a normal state. A visual that throws on it would now fail the whole page.
for (const [name, attrs] of [
  ["a filter that matches no row", `datasets="sales" filter="1 = 0"`],
  ["a dataset that does not exist", `datasets="missing"`],
  ["no dataset", ``],
]) {
  test(`readiness: the table and the charts render with ${name}`, async () => {
    const lines = [];
    const { page } = await load(sales + DATA_HOSTS.map(([tag, own]) => `<${tag} ${own} ${attrs}></${tag}>`).join(""));
    page.on("console", (message) => message.type() === "error" && lines.push(message.text()));

    await until(page, () => window.componentRegisterIsRenderedResult !== undefined);
    await until(
      page,
      () => window.componentRegisterIsRenderedResult === true || window.componentRegisterFailures.length > 0,
    );

    assert.deepEqual(await page.evaluate(() => window.componentRegisterFailures), []);
    assert.deepEqual(lines, []);
  });
}

test("readiness: a page that rendered has the flag true and no failures", async () => {
  const { page } = await open(
    sales + `<bn-layout-page><bn-table slot="slot-0" datasets="sales" scenarios="ac1"></bn-table></bn-layout-page>`,
  );

  assert.deepEqual(
    await page.evaluate(() => ({
      rendered: window.componentRegisterIsRenderedResult,
      failures: window.componentRegisterFailures,
    })),
    { rendered: true, failures: [] },
  );
});

test("readiness: a component that throws in render is a failure, and the flag is false", async () => {
  const lines = [];
  // The script runs while the document is parsed, before the engine module: the first render of the page throws.
  const { page } = await load(
    `<bn-layout-page id="broken"></bn-layout-page><bn-text value="fine"></bn-text>` +
      `<script>document.getElementById("broken").closest = () => { throw new Error("boom"); };</script>`,
  );
  page.on("console", (message) => lines.push(message.text()));

  await until(page, () => window.componentRegisterIsRenderedResult !== undefined);
  // the result is final: wait for one more quiet period and read it again
  await new Promise((resolve) => setTimeout(resolve, 800));

  const result = await page.evaluate(() => ({
    rendered: window.componentRegisterIsRenderedResult,
    failures: window.componentRegisterFailures,
  }));
  assert.equal(result.rendered, false);
  assert.deepEqual(result.failures, [{ tag: "bn-layout-page", id: "broken", message: "boom" }]);
  // same console line as before, with the value false
  assert.ok(lines.includes("componentRegisterIsRendered: false"), lines.join("\n"));
  assert.ok(!lines.includes("componentRegisterIsRendered: true"), lines.join("\n"));
});
