/**
 * Data-point keys and annotation marks against the built package in a real Chrome.
 *
 * Spec tests run under mock-doc, which has no layout and cannot draw a chart.
 * Whether a mark sits on a bar can only be seen in a browser.
 *
 * Usage: npm run build && npm run test:dist
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { esc, open, until } from "./harness.mjs";

const row = (date, rowGroup, rowGroupIndex, category, categoryIndex, values) => ({
  operation: "+",
  setname: "de",
  date,
  rowGroup,
  rowGroupIndex,
  category,
  categoryIndex,
  subCategory: "",
  subCategoryIndex: 1,
  ...values,
});

const ROWS = [
  row("2023-01-01", "Europe", 1, "Hardware", 1, { ac1: 40, ac2: 15, ac3: 4, pl1: 35, pp1: 30 }),
  row("2023-01-01", "Europe", 1, "Software", 2, { ac1: 30, ac2: 10, ac3: 3, pl1: 25, pp1: 20 }),
  row("2024-01-01", "Asia", 2, "Hardware", 1, { ac1: 55, ac2: 20, ac3: 6, pl1: 60, pp1: 40 }),
  row("2024-01-01", "Asia", 2, "Services", 3, { ac1: 25, ac2: 5, ac3: 2, pl1: 30, pp1: 15 }),
];
const DATA = `<bn-datasource name="sales">${esc(JSON.stringify(ROWS))}</bn-datasource>`;

const TIME = `<bn-chart-time datasets="$sales" date-interval="year" scenarios="ac1,pl1" unit-scaling="auto"></bn-chart-time>`;
const TIME_MARKERS = `<bn-chart-time id="markers" datasets="$sales" date-interval="year" scenarios="ac1,pp1,pl1" unit-scaling="auto"></bn-chart-time>`;
const TIME_LINE = `<bn-chart-time id="line" chart-mode="line" datasets="$sales" date-interval="year" scenarios="ac1,pl1" unit-scaling="auto"></bn-chart-time>`;
const TIME_VARIANCE = `<bn-chart-time id="variance" datasets="$sales" date-interval="year" scenarios="ac1,pl1" variances="dac1_pl1_pos" unit-scaling="auto"></bn-chart-time>`;
const TIME_STACKED = `<bn-chart-time datasets="$sales" date-interval="year" scenarios="ac1,ac2" unit-scaling="auto" stack='{"by":"scenarios","mode":"absolute"}'></bn-chart-time>`;
const STRUCTURE = `<bn-chart-structure datasets="$sales" level="category" scenarios="ac1,pl1" unit-scaling="auto"></bn-chart-structure>`;
const STRUCTURE_STACKED = `<bn-chart-structure datasets="$sales" level="rowGroup" scenarios="ac1" unit-scaling="auto" stack='{"by":"dimensions","mode":"absolute"}'></bn-chart-structure>`;
const TABLE = `<bn-table datasets="$sales" type="sum" grouped="true" level="category" scenarios="ac1,pl1" unit-scaling="auto"></bn-table>`;
const SCATTER = `<bn-chart-scatter datasets="$sales" point-level="category" x='{"measure":"ac1"}' y='{"measure":"ac2"}'></bn-chart-scatter>`;
const BUBBLE = `<bn-chart-bubble datasets="$sales" point-level="category" x='{"measure":"ac1"}' y='{"measure":"ac2"}' size='{"measure":"ac3"}'></bn-chart-bubble>`;
const BULLET = `<bn-chart-bullet datasets="$sales" level="category" actual='{"measure":"ac1"}' target='{"measure":"pl1"}'></bn-chart-bullet>`;

const slot = (index, target, content) =>
  `<div slot="slot-${index}" data-bino-annotation-target="${target}">${content}</div>`;
const layer = (items) =>
  `<bn-annotation-layer slot="annotations" items="${esc(JSON.stringify(items))}"></bn-annotation-layer>`;
const pageOf = (slots, items, attrs = 'page-format="xga" page-orientation="landscape"') =>
  `<bn-layout-page page-layout="2x2" ${attrs}>${slots.join("")}${layer(items)}</bn-layout-page>`;

/** Installs `window.deep`, a querySelectorAll that goes through shadow roots. */
const installDeep = (page) =>
  page.evaluate(() => {
    window.deep = (root, selector) => {
      const found = [...root.querySelectorAll(selector)];
      root.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) found.push(...window.deep(el.shadowRoot, selector));
      });
      return found;
    };
  });

const openDeep = async (body, attrs) => {
  const { page } = await open(body, {}, attrs);
  await installDeep(page);
  return page;
};

/** Screen box of the only element matching `selector` inside the target `id`. */
const boxOf = (page, id, selector) =>
  page.evaluate(
    (id, selector) => {
      const host = document.querySelector(`[data-bino-annotation-target="${id}"]`);
      const found = window.deep(host, selector);
      if (found.length !== 1) throw new Error(`${found.length} elements match ${selector}`);
      const r = found[0].getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    },
    id,
    selector,
  );

/** Screen boxes of the shapes of every drawn mark, in item order. */
const drawnMarks = (page) =>
  page.evaluate(() =>
    [...document.querySelector("bn-annotation-layer").shadowRoot.querySelectorAll(".mark")].map((mark) => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      };
      return {
        kind: mark.getAttribute("class").replace("mark ", ""),
        label: mark.querySelector("text")?.textContent ?? null,
        circle: box(mark.querySelector("circle")),
        rect: box(mark.querySelector("rect")),
        line: box(mark.querySelector("line")),
        head: box(mark.querySelector("polygon")),
        tip: (() => {
          const head = mark.querySelector("polygon");
          if (!head) return null;
          const first = head.points[0];
          const screen = new DOMPoint(first.x, first.y).matrixTransform(head.getScreenCTM());
          return { x: screen.x, y: screen.y };
        })(),
      };
    }),
  );

/** Screen box of the text of the only element matching `selector` inside the target `id`. */
const textBoxOf = (page, id, selector) =>
  page.evaluate(
    (id, selector) => {
      const host = document.querySelector(`[data-bino-annotation-target="${id}"]`);
      const [element] = window.deep(host, selector);
      const range = document.createRange();
      range.selectNodeContents(element);
      const r = range.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    },
    id,
    selector,
  );

const disjoint = (a, b) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const assertSameCentre = (actual, expected, message) => {
  const a = centre(actual);
  const b = centre(expected);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1, `${message}: ${JSON.stringify({ a, b })}`);
};

const assertSurrounds = (outer, inner, message) => {
  const fits =
    outer.x <= inner.x + 0.5 &&
    outer.y <= inner.y + 0.5 &&
    outer.x + outer.width >= inner.x + inner.width - 0.5 &&
    outer.y + outer.height >= inner.y + inner.height - 0.5;
  assert.ok(fits, `${message}: ${JSON.stringify({ outer, inner })}`);
};

/** The point lies on the outline of the box. */
const assertOnEdge = (point, box, message) => {
  const inside =
    point.x >= box.x - 1 &&
    point.x <= box.x + box.width + 1 &&
    point.y >= box.y - 1 &&
    point.y <= box.y + box.height + 1;
  const distance = Math.min(
    Math.abs(point.x - box.x),
    Math.abs(point.x - (box.x + box.width)),
    Math.abs(point.y - box.y),
    Math.abs(point.y - (box.y + box.height)),
  );
  assert.ok(inside && distance < 1, `${message}: ${JSON.stringify({ point, box })}`);
};

const POINT_BAR = { date: "2024-01-01", scenario: "ac1" };
const BAR = '[data-bn-date="2024-01-01"][data-bn-scenario="ac1"][data-bn-part="element"]';
const TOTAL_SELECTOR_2023 = '[data-bn-date="2023-01-01"][data-bn-scenario="ac1"][data-bn-part="label"]';
const STRUCTURE_BAR = '[data-bn-category="Software"][data-bn-scenario="ac1"][data-bn-part="element"]';
const CELL = 'td[data-bn-category="Software"][data-bn-scenario="ac1"]';
const ROW = 'tr[data-bn-category="Hardware"][data-bn-row-group="Asia"]';

const FIXTURE_SLOTS = [slot(0, "time", TIME), slot(1, "structure", STRUCTURE), slot(2, "table", TABLE)];
const FIXTURE_ITEMS = [
  { label: "1", mark: "marker", target: "time", point: POINT_BAR },
  { label: "2", mark: "frame", target: "time", point: { date: "2023-01-01", scenario: "ac1", part: "label" } },
  {
    label: "3",
    mark: "arrow",
    color: "negative",
    target: "time",
    point: { date: "2023-01-01", scenario: "ac1" },
    to: "time",
    toPoint: POINT_BAR,
  },
  { label: "4", mark: "marker", target: "structure", point: { category: "Software", scenario: "ac1" } },
  { label: "5", mark: "frame", target: "table", point: { category: "Software", scenario: "ac1" } },
  { label: "6", mark: "marker", target: "table", point: { rowGroup: "Asia", category: "Hardware" } },
];

const assertFixturePlacement = async (page) => {
  const marks = await drawnMarks(page);
  assert.deepEqual(
    marks.map((mark) => [mark.kind, mark.label]),
    [
      ["marker", "1"],
      ["frame", "2"],
      ["arrow", "3"],
      ["marker", "4"],
      ["frame", "5"],
      ["marker", "6"],
    ],
  );

  const bar = await boxOf(page, "time", BAR);
  assertSameCentre(marks[0].circle, bar, "marker on a bar");

  assertSurrounds(marks[1].rect, await boxOf(page, "time", TOTAL_SELECTOR_2023), "frame around a label");

  // the arrow runs from the edge of the 2023 bar to the edge of the 2024 bar
  const start = await boxOf(
    page,
    "time",
    '[data-bn-date="2023-01-01"][data-bn-scenario="ac1"][data-bn-part="element"]',
  );
  assertOnEdge(centre(marks[2].circle), start, "arrow starts at the edge of the first bar");
  assertOnEdge(marks[2].tip, bar, "arrow ends at the edge of the second bar");

  assertSameCentre(marks[3].circle, await boxOf(page, "structure", STRUCTURE_BAR), "marker on a structure bar");
  // the frame sits on the number in the cell, not on the cell, and the marker does not cover a number
  const text = await textBoxOf(page, "table", CELL);
  assertSurrounds(marks[4].rect, text, "frame around the number of a table cell");
  assertSameCentre(marks[4].rect, text, "frame centred on the number");
  const cellBox = await boxOf(page, "table", CELL);
  assert.ok(marks[4].rect.width < cellBox.width + cellBox.height, "the frame is about the size of the number");
  assertSameCentre(marks[5].circle, await boxOf(page, "table", ROW), "marker on a whole table row");
};

test("keys: every data point carries its raw values, and the layout state reports them", async () => {
  const page = await openDeep(
    DATA +
      `<bn-layout-page page-layout="full" page-format="a0">` +
      slot(
        0,
        "t",
        TIME +
          TIME_MARKERS +
          TIME_LINE +
          TIME_VARIANCE +
          TIME_STACKED +
          STRUCTURE +
          STRUCTURE_STACKED +
          TABLE +
          SCATTER +
          BUBBLE +
          BULLET,
      ) +
      `</bn-layout-page>`,
  );

  const states = await page.evaluate(async () => {
    const out = {};
    for (const [name, selector] of [
      ["time", "bn-chart-time"],
      ["markers", "#markers"],
      ["line", "#line"],
      ["variance", "#variance"],
      ["timeStacked", "bn-chart-time[stack]"],
      ["structure", "bn-chart-structure"],
      ["structureStacked", "bn-chart-structure[stack]"],
      ["table", "bn-table"],
      ["scatter", "bn-chart-scatter"],
      ["bubble", "bn-chart-bubble"],
      ["bullet", "bn-chart-bullet"],
    ]) {
      const state = await document.querySelector(selector).getLayoutState({ detail: "full" });
      out[name] = {
        barCount: state.metadata.barCount,
        hasNoData: state.metadata.hasNoData,
        rows: state.table?.rows.filter((r) => r.point).map((r) => r.point) ?? [],
        points: (state.elements ?? []).filter((e) => e.point).map((e) => ({ kind: e.kind, ...e.point })),
      };
    }
    return out;
  });

  const has = (name, expected) => {
    const found = states[name].points.some((point) =>
      Object.entries(expected).every(([field, value]) => point[field] === value),
    );
    assert.ok(found, `${name} has ${JSON.stringify(expected)}: ${JSON.stringify(states[name].points)}`);
  };

  has("time", { kind: "bar", date: "2024-01-01", scenario: "ac1", part: "element" });
  has("time", { kind: "label", date: "2024-01-01", scenario: "ac1", part: "label" });
  has("time", { kind: "bar", date: "2024-01-01", scenario: "pl1", part: "element" });
  has("markers", { kind: "point", date: "2024-01-01", scenario: "pp1", part: "element" });
  has("line", { kind: "point", date: "2024-01-01", scenario: "ac1", part: "element" });
  has("line", { kind: "label", date: "2024-01-01", scenario: "ac1", part: "label" });
  has("variance", { kind: "bar", date: "2024-01-01", scenario: "dac1_pl1_pos", part: "element" });
  has("variance", { kind: "label", date: "2024-01-01", scenario: "dac1_pl1_pos", part: "label" });

  assert.ok(states.timeStacked.barCount > 0, "a stacked chart counts its stacks");
  assert.equal(states.timeStacked.hasNoData, false);
  has("timeStacked", { kind: "bar", date: "2024-01-01", scenario: "ac2", part: "element" });
  has("timeStacked", { kind: "label", date: "2024-01-01", part: "total" });

  has("structure", { kind: "bar", category: "Software", scenario: "ac1", part: "element" });
  has("structure", { kind: "label", category: "Software", scenario: "ac1", part: "label" });

  assert.ok(states.structureStacked.barCount > 0);
  has("structureStacked", { kind: "bar", rowGroup: "Asia", category: "Services", scenario: "ac1", part: "element" });
  has("structureStacked", { kind: "label", rowGroup: "Asia", part: "total" });

  has("table", { kind: "cell", rowGroup: "Asia", category: "Services", scenario: "ac1", part: "element" });
  has("table", { kind: "cell", rowGroup: "Asia", row: "subtotal", scenario: "ac1" });
  has("table", { kind: "cell", row: "total", scenario: "ac1" });
  assert.ok(states.table.rows.some((r) => r.row === "total" && r.rowGroup === undefined));
  assert.ok(states.table.rows.some((r) => r.row === "subtotal" && r.rowGroup === "Europe"));

  has("scatter", { kind: "point", category: "Software", part: "element" });
  has("bubble", { kind: "point", category: "Software", part: "element" });
  has("bullet", { kind: "bar", category: "Software", scenario: "ac1", part: "element" });
  has("bullet", { kind: "label", category: "Software", scenario: "ac1", part: "label" });
});

test("marks: marker, frame and arrow sit on their elements", async () => {
  const page = await openDeep(DATA + pageOf(FIXTURE_SLOTS, FIXTURE_ITEMS));
  await assertFixturePlacement(page);
});

test("marks: a rotated page has them on the same elements", async () => {
  const page = await openDeep(DATA + pageOf(FIXTURE_SLOTS, FIXTURE_ITEMS), 'render-orientation="portrait"');
  const turned = await page.$eval("bn-layout-page", (el) => el.shadowRoot.querySelector("bn-page").style.transform);
  assert.match(turned, /rotate/);
  await assertFixturePlacement(page);
});

test("marks: a component without a point takes the mark on its top-right corner", async () => {
  const page = await openDeep(DATA + pageOf(FIXTURE_SLOTS, [{ label: "1", target: "structure" }]));
  const [mark] = await drawnMarks(page);
  const host = await page.$eval("[data-bino-annotation-target=structure] > *", (el) => {
    const r = el.getBoundingClientRect();
    return { right: r.right, top: r.top };
  });
  assert.ok(Math.abs(mark.circle.x + mark.circle.width - host.right) < 1, JSON.stringify({ mark, host }));
  assert.ok(Math.abs(mark.circle.y - host.top) < 1, JSON.stringify({ mark, host }));
});

/** Waits until the marker is back on the bar, and the bar has moved away from where it was. */
const markerFollows = async (page, before) => {
  await page.evaluate((before) => {
    window.barBefore = before;
  }, JSON.stringify(before));
  await until(page, () => {
    const host = document.querySelector("[data-bino-annotation-target=time]");
    const bar = window
      .deep(host, '[data-bn-date="2024-01-01"][data-bn-scenario="ac1"][data-bn-part="element"]')[0]
      .getBoundingClientRect();
    const circle = document
      .querySelector("bn-annotation-layer")
      .shadowRoot.querySelector("circle")
      .getBoundingClientRect();
    const now = { x: bar.left, y: bar.top, width: bar.width, height: bar.height };
    return (
      window.barBefore !== JSON.stringify(now) &&
      Math.hypot(
        bar.left + bar.width / 2 - (circle.left + circle.width / 2),
        bar.top + bar.height / 2 - (circle.top + circle.height / 2),
      ) < 1
    );
  });
};

test("marks: they follow a chart that draws again", async () => {
  const page = await openDeep(DATA + pageOf(FIXTURE_SLOTS, FIXTURE_ITEMS.slice(0, 1)));
  const before = await boxOf(page, "time", BAR);
  await page.$eval("bn-chart-time", (el) => el.setAttribute("unit-scaling", "5"));
  await markerFollows(page, before);
  assert.notDeepEqual(await boxOf(page, "time", BAR), before);
});

test("marks: they follow a target that moves when its cell changes", async () => {
  const page = await openDeep(DATA + pageOf(FIXTURE_SLOTS, FIXTURE_ITEMS.slice(0, 1)));
  const before = await boxOf(page, "time", BAR);
  await page.$eval("[data-bino-annotation-target=time]", (el) => {
    el.style.paddingLeft = "60px";
  });
  await markerFollows(page, before);
  assert.notDeepEqual(await boxOf(page, "time", BAR), before);
});

for (const [name, point] of [
  ["no match", { date: "1999-01-01", scenario: "ac1" }],
  ["two matches", { date: "2024-01-01" }],
]) {
  test(`marks: ${name} draws nothing, does not fail, and the list drops the circle`, async () => {
    const warnings = [];
    const items = [
      { label: "1", target: "structure", point: { category: "Software", scenario: "ac1" } },
      { label: "2", target: "time", point },
    ];
    const list = [
      { label: "1", title: "Placed", html: "shown <b>with</b> its number" },
      { label: "2", title: "Missing", html: "shown without a number" },
      { title: "Plain", html: "<img src=x onerror=alert(1)>never had a number" },
    ];
    const body =
      DATA +
      pageOf(
        [
          ...FIXTURE_SLOTS.slice(0, 2),
          `<div slot="slot-2"><bn-annotation-list items="${esc(JSON.stringify(list))}"></bn-annotation-list></div>`,
        ],
        items,
      );
    const { page } = await open(body);
    await installDeep(page);
    page.on("console", (message) => {
      if (message.type() === "warn") warnings.push(message.text());
    });

    const result = await page.evaluate(() => {
      const layer = document.querySelector("bn-annotation-layer");
      const entries = [...document.querySelector("bn-annotation-list").shadowRoot.querySelectorAll("li")];
      return {
        marks: layer.shadowRoot.querySelectorAll(".mark").length,
        layerError: layer.getAttribute("has-error"),
        rendered: window.componentRegisterIsRenderedResult,
        failures: window.componentRegisterFailures,
        entries: entries.map((li) => ({
          badge: li.querySelector(".badge")?.textContent ?? null,
          title: li.querySelector(".title")?.textContent.trim() ?? null,
          hasBold: li.querySelector("b") !== null,
          hasHandler: li.innerHTML.includes("onerror"),
        })),
      };
    });

    assert.equal(result.marks, 1);
    assert.equal(result.layerError, null);
    assert.equal(result.rendered, true);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(
      result.entries.map((entry) => [entry.badge, entry.title]),
      [
        ["1", "Placed"],
        [null, "Missing"],
        [null, "Plain"],
      ],
    );
    assert.equal(result.entries[0].hasBold, true, "the text is markup");
    assert.equal(result.entries[2].hasHandler, false, "the text is sanitized");
  });
}

test("marks: broken items are an error of the layer, and the other components are fine", async () => {
  const { page } = await open(
    DATA +
      `<bn-layout-page><bn-annotation-layer slot="annotations" items="not json"></bn-annotation-layer></bn-layout-page>`,
  ).catch((e) => ({ error: e }));
  // a has-error item does not make the page "not rendered"
  assert.ok(page, "the page settles");
  const items = await page.$eval("bn-annotation-layer", (el) => JSON.parse(el.getAttribute("has-error")));
  assert.deepEqual(
    items.map((item) => [item.id, item.type]),
    [["ERR_items", "error"]],
  );
});

test("table: the parent of a thereof row, a date bucket and a REST row of a group can be named", async () => {
  const rows = [
    { ...row("2023-01-01", "Europe", 1, "A", 1, { ac1: 10 }), subCategory: "X", subCategoryIndex: 1 },
    { ...row("2024-01-01", "Europe", 1, "A", 1, { ac1: 20 }), subCategory: "Y", subCategoryIndex: 2 },
    row("2024-01-01", "Europe", 1, "B", 2, { ac1: 5 }),
    row("2024-01-01", "Europe", 1, "C", 3, { ac1: 4 }),
  ];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const common = `datasets="$t" level="category" scenarios="ac1" unit-scaling="auto"`;
  const thereof = `<bn-table ${common} thereof='[{"category":"A","subCategory":"X"}]'></bn-table>`;
  const interval = `<bn-table ${common} interval="year"></bn-table>`;
  const rest = `<bn-table ${common} type="sum" grouped="true" limit="1"></bn-table>`;
  const items = [
    { label: "1", target: "thereof", point: { category: "A" } },
    { label: "2", target: "thereof", point: { category: "A", subCategory: "X" } },
    { label: "3", target: "interval", point: { category: "A", scenario: "ac1", date: "2024-01-01" } },
    { label: "4", target: "rest", point: { rowGroup: "Europe", category: "REST", scenario: "ac1" } },
  ];
  const page = await openDeep(
    data + pageOf([slot(0, "thereof", thereof), slot(1, "interval", interval), slot(2, "rest", rest)], items),
  );

  const marks = await drawnMarks(page);
  assert.deepEqual(
    marks.map((mark) => mark.label),
    ["1", "2", "3", "4"],
  );
  assertSameCentre(
    marks[0].circle,
    await boxOf(page, "thereof", 'tr[data-bn-category="A"]:not([data-bn-sub-category])'),
    "parent row",
  );
  assertSameCentre(marks[1].circle, await boxOf(page, "thereof", 'tr[data-bn-sub-category="X"]'), "thereof row");
  // a marker on a cell sits next to the number, on its line
  for (const [mark, id, selector] of [
    [marks[2], "interval", 'td[data-bn-category="A"][data-bn-date="2024-01-01"]'],
    [marks[3], "rest", 'td[data-bn-category="REST"][data-bn-scenario="ac1"]'],
  ]) {
    const text = await textBoxOf(page, id, selector);
    assert.ok(disjoint(mark.circle, text), JSON.stringify({ label: mark.label, circle: mark.circle, text }));
    assert.ok(Math.abs(centre(mark.circle).y - centre(text).y) < 1, JSON.stringify({ circle: mark.circle, text }));
  }
});

test("table: a marker on a cell does not cover any number of its row", async () => {
  const items = [
    { label: "1", target: "table", point: { row: "total", scenario: "pl1" } },
    { label: "2", target: "table", point: { row: "total", scenario: "ac1" } },
    { label: "3", target: "table", point: { rowGroup: "Europe", category: "Software", scenario: "ac1" } },
  ];
  const page = await openDeep(DATA + pageOf(FIXTURE_SLOTS, items));
  const marks = await drawnMarks(page);
  assert.equal(marks.length, 3);

  const numbers = await page.evaluate(() => {
    const host = document.querySelector('[data-bino-annotation-target="table"]');
    return window.deep(host, "td[data-bn-part]").flatMap((td) => {
      const range = document.createRange();
      range.selectNodeContents(td);
      const r = range.getBoundingClientRect();
      return r.width > 0 ? [{ x: r.left, y: r.top, width: r.width, height: r.height }] : [];
    });
  });
  for (const mark of marks) {
    for (const number of numbers) {
      assert.ok(disjoint(mark.circle, number), JSON.stringify({ label: mark.label, circle: mark.circle, number }));
    }
  }
});

const PAGE = 'page-format="xga" page-orientation="landscape"';
const SCALED = `${PAGE} style="transform: scale(0.7); transform-origin: 0 0"`;
for (const [name, contextAttrs, pageAttrs, scale] of [
  ["on a page", "", PAGE, 1],
  ["on a rotated page", 'render-orientation="portrait"', PAGE, 1],
  ["on a scaled page", "", SCALED, 0.7],
  ["on a scaled and rotated page", 'render-orientation="portrait"', SCALED, 0.7],
]) {
  test(`table: the marks around a cell know what the cell shows, ${name}`, async () => {
    const long = "A category label that is much too long for its column";
    const rows = [
      row("2024-01-01", "E", 1, long, 1, { ac1: 50, pl1: 20 }),
      row("2024-01-01", "E", 1, "B", 2, { ac1: 10, pl1: 30 }),
    ];
    const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
    const common = `datasets="$t" level="category" scenarios="ac1,pl1" variances="dac1_pl1_pos" unit-scaling="auto"`;
    const plain = `<bn-table ${common} category-width="w5"></bn-table>`;
    const bars = `<bn-table ${common} bar-columns="dac1_pl1_pos" bar-column-width="w15"></bn-table>`;
    const items = [
      { label: "1", target: "plain", point: { category: "B", scenario: "dac1_pl1_pos" } },
      { mark: "frame", target: "plain", point: { category: long, scenario: "dac1_pl1_pos" } },
      { mark: "frame", target: "bars", point: { category: "B", scenario: "dac1_pl1_pos" } },
    ];
    const page = await openDeep(
      data + pageOf([slot(0, "plain", plain), slot(1, "bars", bars)], items, pageAttrs),
      contextAttrs,
    );

    const result = await page.evaluate((long) => {
      const box = (r) => ({ x: r.left, y: r.top, width: r.width, height: r.height });
      const at = (id, selector) =>
        window.deep(document.querySelector(`[data-bino-annotation-target="${id}"]`), selector)[0];
      const textOf = (td) => {
        const range = document.createRange();
        range.selectNodeContents(td);
        return box(range.getBoundingClientRect());
      };
      const variance = at("plain", `td[data-bn-category="${long}"][data-bn-scenario="dac1_pl1_pos"]`);
      const label = at("plain", `td[data-bn-category="${long}"][data-bn-scenario="category"]`);
      const barCell = at("bars", 'td[data-bn-category="B"][data-bn-scenario="dac1_pl1_pos"]');
      return {
        before: getComputedStyle(variance, "::before").content,
        varianceText: textOf(variance),
        labelBox: box(label.getBoundingClientRect()),
        labelText: textOf(label),
        barNumber: box(barCell.querySelector("svg text").getBoundingClientRect()),
        barChart: box(barCell.querySelector("svg").getBoundingClientRect()),
      };
    }, long);
    assert.equal(result.before, '"+"', "a positive variance has its sign in a pseudo element");

    const marks = await drawnMarks(page);
    assert.equal(marks.length, 3);

    // the oval takes the sign in: on one side it reaches further than the padding alone
    const oval = marks[1].rect;
    const text = result.varianceText;
    assertSurrounds(oval, text, "oval around the number");
    const spare = Math.max(text.x - oval.x, oval.y + oval.height - (text.y + text.height));
    assert.ok(spare > (0.45 * 13 + 3) * scale, `the sign is in the box: ${JSON.stringify({ oval, text })}`);

    // the marker stays clear of the number. B is negative: its sign is part of the text
    const markerText = await textBoxOf(page, "plain", 'td[data-bn-category="B"][data-bn-scenario="dac1_pl1_pos"]');
    assert.ok(disjoint(marks[0].circle, markerText), JSON.stringify({ circle: marks[0].circle, markerText }));

    // a bar cell: the oval goes around the number, not around the whole bar
    assertSurrounds(marks[2].rect, result.barNumber, "oval around the number of a bar");
    const longSide = (b) => Math.max(b.width, b.height);
    assert.ok(longSide(marks[2].rect) < longSide(result.barChart) * 0.6, JSON.stringify(marks[2].rect));

    // a clipped label is no longer than its cell
    const content = await page.evaluate(async (long) => {
      const state = await document.querySelector("bn-table").getLayoutState({ detail: "full" });
      const cell = state.elements.find((e) => e.point?.category === long && e.point.scenario === "category");
      return { content: cell.content.component, rect: cell.rect.component };
    }, long);
    assert.ok(longSide(result.labelText) > longSide(result.labelBox), "the label is cut off by its cell");
    assert.ok(longSide(content.content) <= longSide(content.rect) + 0.5, JSON.stringify(content));
  });
}

test("table: the hidden prefix of a second thereof row is not part of the text", async () => {
  const rows = [
    { ...row("2024-01-01", "E", 1, "A", 1, { ac1: 10 }), subCategory: "X", subCategoryIndex: 1 },
    { ...row("2024-01-01", "E", 1, "A", 1, { ac1: 20 }), subCategory: "Y", subCategoryIndex: 2 },
  ];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1" unit-scaling="auto" thereof='[{"category":"A"}]'></bn-table>`;
  const items = [{ mark: "frame", target: "t", point: { category: "A", subCategory: "Y", scenario: "category" } }];
  const page = await openDeep(data + pageOf([slot(0, "t", table)], items));

  const [mark] = await drawnMarks(page);
  const visible = await page.evaluate(() => {
    const host = document.querySelector('[data-bino-annotation-target="t"]');
    const td = window.deep(host, 'td[data-bn-sub-category="Y"][data-bn-scenario="category"]')[0];
    const range = document.createRange();
    range.selectNodeContents(td);
    const prefix = td.querySelector(".prefix-second");
    if (!prefix || prefix.textContent.trim() === "") throw new Error("the row has no hidden prefix");
    range.setStartAfter(prefix);
    const r = range.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  assertSameCentre(mark.rect, visible, "frame around the visible label");
});

test("table: in a dense table the marker gets smaller and stays between the numbers", async () => {
  const rows = [row("2024-01-01", "E", 1, "A", 1, { ac1: 1234, pl1: 1234, fc1: 1234 })];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1,pl1,fc1" unit-scaling="auto"></bn-table>`;
  const items = [{ label: "1", target: "t", point: { category: "A", scenario: "fc1" } }];
  const page = await openDeep(data + pageOf([slot(0, "t", table)], items));

  const [mark] = await drawnMarks(page);
  const texts = await page.evaluate(() => {
    const host = document.querySelector('[data-bino-annotation-target="t"]');
    return ["ac1", "pl1", "fc1"].map((scenario) => {
      const range = document.createRange();
      range.selectNodeContents(window.deep(host, `td[data-bn-category="A"][data-bn-scenario="${scenario}"]`)[0]);
      const r = range.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
  });
  const middle = centre(mark.circle);
  assert.ok(mark.circle.width < 14, JSON.stringify(mark.circle));
  // SVG text boxes round: the whole circle stays clear of the numbers, with half a pixel to spare
  const inset = (text) => ({ ...text, x: text.x + 0.5, width: text.width - 1 });
  assert.ok(
    texts.every((text) => disjoint(mark.circle, inset(text))),
    JSON.stringify({ circle: mark.circle, texts }),
  );
  const line = centre(texts[2]);
  assert.ok(Math.abs(middle.y - line.y) < 1, JSON.stringify({ middle, line }));
});

test("table: in a scaled dense table the marker scales with the numbers and stays clear of them", async () => {
  const rows = [row("2024-01-01", "E", 1, "A", 1, { ac1: 1234, pl1: 1234, fc1: 1234 })];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1,pl1,fc1" unit-scaling="auto" scale="0.5"></bn-table>`;
  const items = [{ label: "1", target: "t", point: { category: "A", scenario: "fc1" } }];
  const page = await openDeep(data + pageOf([slot(0, "t", table)], items));

  const [mark] = await drawnMarks(page);
  const texts = await page.evaluate(() => {
    const host = document.querySelector('[data-bino-annotation-target="t"]');
    return ["ac1", "pl1", "fc1"].map((scenario) => {
      const range = document.createRange();
      range.selectNodeContents(window.deep(host, `td[data-bn-category="A"][data-bn-scenario="${scenario}"]`)[0]);
      const r = range.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
  });
  assert.ok(mark.circle.width <= texts[2].height, JSON.stringify({ circle: mark.circle, text: texts[2] }));
  const inset = (text) => ({ ...text, x: text.x + 0.5, width: text.width - 1 });
  assert.ok(
    texts.every((text) => disjoint(mark.circle, inset(text))),
    JSON.stringify({ circle: mark.circle, texts }),
  );
});

test("marks: a config element in the slot is not the target", async () => {
  const group = `<bn-scaling-group name="s" value="100"></bn-scaling-group>`;
  const items = [
    { label: "1", target: "t" },
    { label: "2", target: "t", point: { category: "Software", scenario: "ac1" } },
  ];
  const page = await openDeep(DATA + pageOf([slot(0, "t", group + STRUCTURE)], items));
  assert.deepEqual(
    (await drawnMarks(page)).map((mark) => mark.label),
    ["1", "2"],
  );
});

test("table: a marker on a row of a narrow, scaled table stays clear of the numbers", async () => {
  const rows = [row("2024-01-01", "E", 1, "A", 1, { ac1: 1234, pl1: 1234, fc1: 1234, pp1: 1234 })];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1,pl1,fc1,pp1" unit-scaling="auto" scale="0.5" category-width="w5"></bn-table>`;
  const items = [{ label: "1", target: "t", point: { category: "A" } }];
  const page = await openDeep(data + pageOf([slot(0, "t", table)], items));

  const [mark] = await drawnMarks(page);
  const { numbers, rowBox } = await page.evaluate(() => {
    const host = document.querySelector('[data-bino-annotation-target="t"]');
    const box = (r) => ({ x: r.left, y: r.top, width: r.width, height: r.height });
    return {
      rowBox: box(window.deep(host, 'tr[data-bn-category="A"]')[0].getBoundingClientRect()),
      numbers: window.deep(host, 'td[data-bn-part]:not([data-bn-scenario="category"])').map((td) => {
        const range = document.createRange();
        range.selectNodeContents(td);
        return box(range.getBoundingClientRect());
      }),
    };
  });
  assert.ok(mark.circle.height <= rowBox.height + 1, JSON.stringify({ circle: mark.circle, rowBox }));
  const inset = (text) => ({ ...text, x: text.x + 0.5, width: text.width - 1 });
  assert.ok(
    numbers.every((n) => disjoint(mark.circle, inset(n))),
    JSON.stringify({ circle: mark.circle, numbers }),
  );
});

test("marks: a whole component that cannot be seen gets no mark, and its label counts as not placed", async () => {
  // page-layout="full" has no slot-1, so the target is not rendered
  const list = `<bn-annotation-list slot="slot-0" items="${esc(JSON.stringify([{ label: "1", title: "x" }]))}"></bn-annotation-list>`;
  const target = `<div slot="slot-1" data-bino-annotation-target="t">${TIME}</div>`;
  const body = `<bn-layout-page page-layout="full" page-format="xga" page-orientation="landscape">${list}${target}${layer([{ label: "1", target: "t" }])}</bn-layout-page>`;
  const page = await openDeep(DATA + body);

  assert.deepEqual(await drawnMarks(page), []);
  const badges = await page.$eval("bn-annotation-list", (el) => el.shadowRoot.querySelectorAll(".badge").length);
  assert.equal(badges, 0);
});

test("marks: they follow a table that patches its cells in place", async () => {
  const rows = [row("2024-01-01", "E", 1, "A", 1, { ac1: 50, pl1: 20 })];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource><bn-scaling-group name="s" value="100"></bn-scaling-group>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1,pl1" variances="dac1_pl1_pos" bar-columns="dac1_pl1_pos" bar-column-width="w15" unit-scaling="s"></bn-table>`;
  const items = [{ mark: "frame", target: "t", point: { category: "A", scenario: "dac1_pl1_pos" } }];
  const page = await openDeep(data + pageOf([slot(0, "t", table)], items));
  const label = () =>
    page.evaluate(() => {
      const host = document.querySelector('[data-bino-annotation-target="t"]');
      const r = window.deep(host, "svg.cell-bar-chart text")[0].getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
  const before = await label();

  await page.$eval("bn-scaling-group", (el) => el.setAttribute("value", "400"));
  await until(page, () => {
    const host = document.querySelector('[data-bino-annotation-target="t"]');
    const text = window.deep(host, "svg.cell-bar-chart text")[0].getBoundingClientRect();
    const frame = document
      .querySelector("bn-annotation-layer")
      .shadowRoot.querySelector("rect")
      .getBoundingClientRect();
    return Math.abs(text.left + text.width / 2 - (frame.left + frame.width / 2)) < 1;
  });
  assert.notDeepEqual(await label(), before, "the number has moved");
});

test("marks: a target that is added later gets its mark", async () => {
  const items = [{ label: "1", target: "late", point: { category: "Software", scenario: "ac1" } }];
  const page = await openDeep(DATA + pageOf([slot(0, "time", TIME)], items));
  assert.deepEqual(await drawnMarks(page), []);

  await page.$eval(
    "bn-layout-page",
    (el, markup) => el.insertAdjacentHTML("afterbegin", markup),
    slot(1, "late", STRUCTURE),
  );
  await until(
    page,
    () => document.querySelector("bn-annotation-layer").shadowRoot.querySelectorAll(".mark").length === 1,
  );
});

test("table: a cell with an empty text has no key", async () => {
  const rows = [{ ...row("2024-01-01", "E", 1, "A", 1, { ac1: 1 }), _lead: "" }];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1" unit-scaling="auto" attributes='{"Lead":"first(_lead)"}'></bn-table>`;
  const items = [{ label: "1", target: "t", point: { category: "A", scenario: "Lead" } }];
  const page = await openDeep(data + pageOf([slot(0, "t", table)], items));
  assert.deepEqual(await drawnMarks(page), []);
});

test("style: null in the style section costs the colour, not the marks", async () => {
  for (const body of [{ "bn-annotation": null }, { "bn-annotation": { color: null, colors: null } }]) {
    const style = `<bn-component-style name="_default">${esc(JSON.stringify(body))}</bn-component-style>`;
    const items = [
      { label: "1", target: "structure", point: { category: "Software", scenario: "ac1" } },
      { label: "2", color: "negative", target: "structure", point: { category: "Hardware", scenario: "ac1" } },
    ];
    const page = await openDeep(style + DATA + pageOf([FIXTURE_SLOTS[1]], items));
    assert.equal((await drawnMarks(page)).length, 2, JSON.stringify(body));
  }
});

test("security: a row value in a data-bn attribute stays a value", async () => {
  const evil = '"><img src=x onerror="window.__evil=1">';
  const rows = [row("2024-01-01", "E", 1, evil, 1, { ac1: 10, ac2: 2, pl1: 5 })];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const structure = `<bn-chart-structure datasets="$t" level="category" scenarios="ac1" unit-scaling="auto"></bn-chart-structure>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1" unit-scaling="auto"></bn-table>`;
  const page = await openDeep(data + pageOf([slot(0, "c", structure), slot(1, "t", table)], []));
  const result = await page.evaluate(() => ({
    images: window.deep(document, "img").length,
    evil: window.__evil ?? null,
    values: window.deep(document, "[data-bn-part][data-bn-category]").map((el) => el.getAttribute("data-bn-category")),
  }));
  assert.equal(result.images, 0);
  assert.equal(result.evil, null);
  assert.ok(result.values.length > 1 && result.values.every((value) => value === evil), JSON.stringify(result.values));
});

test("layout state: a line marker and a bullet bar report the ordinal of their category", async () => {
  const rows = [
    row("2023-01-01", "E", 1, "A", 1, { ac1: 10, pl1: 5 }),
    row("2024-01-01", "E", 1, "B", 2, { ac1: 20 }),
    row("2025-01-01", "E", 1, "C", 3, { ac1: 30, pl1: 15 }),
  ];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const line = `<bn-chart-time chart-mode="line" datasets="$t" date-interval="year" scenarios="ac1,pl1" unit-scaling="auto"></bn-chart-time>`;
  const bullet = `<bn-chart-bullet datasets="$t" level="category" actual='{"measure":"ac1"}' target='{"measure":"pl1"}'></bn-chart-bullet>`;
  const page = await openDeep(data + pageOf([slot(0, "l", line), slot(1, "b", bullet)], []));
  const result = await page.evaluate(async () => {
    const line = await document.querySelector("bn-chart-time").getLayoutState({ detail: "full" });
    const bullet = await document.querySelector("bn-chart-bullet").getLayoutState({ detail: "full" });
    return {
      line: line.elements.filter((e) => e.kind === "point" && e.point?.scenario === "ac1").map((e) => e.index),
      bullet: bullet.elements.filter((e) => e.kind === "bar").map((e) => [e.point.category, e.index]),
    };
  });
  assert.deepEqual(result.line, [0, 1, 2]);
  assert.deepEqual(result.bullet, [
    ["A", 0],
    ["C", 2],
  ]);
});

test("style: a _default style that comes after the page reaches the marks", async () => {
  const items = [{ label: "1", target: "structure", point: { category: "Software", scenario: "ac1" } }];
  const style = `<bn-component-style name="_default">${esc(JSON.stringify({ "bn-annotation": { color: "#112233" } }))}</bn-component-style>`;
  const page = await openDeep(DATA + pageOf([FIXTURE_SLOTS[1]], items) + style);
  await until(
    page,
    () =>
      getComputedStyle(document.querySelector("bn-annotation-layer").shadowRoot.querySelector("circle")).fill ===
      "rgb(17, 34, 51)",
  );
});

test("style: the colours come from the style section bn-annotation", async () => {
  const style = (name, body) => `<bn-component-style name="${name}">${esc(JSON.stringify(body))}</bn-component-style>`;
  const items = [
    { label: "1", target: "structure", point: { category: "Software", scenario: "ac1" } },
    { label: "2", color: "brand", target: "structure", point: { category: "Hardware", scenario: "ac1" } },
    { label: "3", color: "negative", target: "structure", point: { category: "Services", scenario: "ac1" } },
  ];
  const list = `<div slot="slot-2"><bn-annotation-list items="${esc(JSON.stringify([{ label: "1", title: "x" }]))}"></bn-annotation-list></div>`;
  const page = await openDeep(
    style("_default", { "bn-annotation": { color: "#112233", colors: { brand: "#445566" } } }) +
      DATA +
      pageOf([FIXTURE_SLOTS[1], list], items),
  );
  const fills = () =>
    page.evaluate(() => ({
      marks: [...document.querySelector("bn-annotation-layer").shadowRoot.querySelectorAll("circle")].map(
        (circle) => getComputedStyle(circle).fill,
      ),
      list: getComputedStyle(document.querySelector("bn-annotation-list").shadowRoot.querySelector(".badge"))
        .backgroundColor,
    }));

  assert.deepEqual(await fills(), {
    marks: ["rgb(17, 34, 51)", "rgb(68, 85, 102)", "rgb(255, 0, 0)"],
    list: "rgb(17, 34, 51)",
  });

  // a custom property of the page wins over the style
  await page.$eval("bn-layout-page", (el) => el.style.setProperty("--bn-annotation-color", "#010203"));
  assert.equal((await fills()).marks[0], "rgb(1, 2, 3)");
});

test("style: a style that comes after the page, and a selected style, reach the marks", async () => {
  const style = (name, color) =>
    `<bn-component-style name="${name}">${esc(JSON.stringify({ "bn-annotation": { color } }))}</bn-component-style>`;
  const items = [{ label: "1", target: "structure", point: { category: "Software", scenario: "ac1" } }];
  const page = await openDeep(
    DATA +
      pageOf([FIXTURE_SLOTS[1]], items).replace("<bn-annotation-layer", '<bn-annotation-layer selected-style="late"') +
      style("late", "#112233"),
  );
  const fill = await page.$eval(
    "bn-annotation-layer",
    (el) => getComputedStyle(el.shadowRoot.querySelector("circle")).fill,
  );
  assert.equal(fill, "rgb(17, 34, 51)");
});

test("table: a cell without a value has no key, and a mark on it is not drawn", async () => {
  const rows = [row("2023-01-01", "E", 1, "A", 1, { ac1: 10 }), row("2024-01-01", "E", 1, "B", 2, { ac1: 5 })];
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1" unit-scaling="auto" interval="year"></bn-table>`;
  const items = [
    { label: "1", target: "t", point: { category: "A", date: "2023-01-01", scenario: "ac1" } },
    { label: "2", target: "t", point: { category: "A", date: "2024-01-01", scenario: "ac1" } },
  ];
  const page = await openDeep(data + pageOf([slot(0, "t", table)], items));

  assert.deepEqual(
    (await drawnMarks(page)).map((mark) => mark.label),
    ["1"],
  );
});

test("marks: a point cut off by its cell is not drawn on the next component", async () => {
  const rows = Array.from({ length: 60 }, (_, index) =>
    row("2024-01-01", "E", 1, `Row${index}`, index + 1, { ac1: index + 1, ac2: 1 }),
  );
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1" unit-scaling="auto" order="category"></bn-table>`;
  const list = [
    { label: "1", title: "visible" },
    { label: "2", title: "cut off" },
  ];
  const items = [
    { label: "1", target: "t", point: { category: "Row0" } },
    { label: "2", target: "t", point: { category: "Row9" } },
  ];
  const lastRow = await (async () => {
    const page = await openDeep(
      data +
        pageOf(
          [
            slot(0, "t", table),
            `<div slot="slot-2"><bn-annotation-list items="${esc(JSON.stringify(list))}"></bn-annotation-list></div>`,
          ],
          items,
        ),
    );
    const cell = await page.$eval("[data-bino-annotation-target=t]", (el) => el.getBoundingClientRect().bottom);
    const row9 = await boxOf(page, "t", 'tr[data-bn-category="Row9"]');
    assert.ok(row9.y > cell, `Row9 is below the cell: ${JSON.stringify({ row9, cell })}`);
    return {
      marks: await drawnMarks(page),
      badges: await page.$eval("bn-annotation-list", (el) =>
        [...el.shadowRoot.querySelectorAll(".badge")].map((b) => b.textContent),
      ),
    };
  })();

  assert.deepEqual(
    lastRow.marks.map((mark) => mark.label),
    ["1"],
  );
  assert.deepEqual(lastRow.badges, ["1"]);
});

test("marks: a point cut off in a fit-to-content card is not drawn on the next component", async () => {
  const rows = Array.from({ length: 60 }, (_, index) =>
    row("2024-01-01", "E", 1, `Row${index}`, index + 1, { ac1: index + 1 }),
  );
  const data = `<bn-datasource name="t">${esc(JSON.stringify(rows))}</bn-datasource>`;
  const table = `<bn-table datasets="$t" level="category" scenarios="ac1" unit-scaling="auto" order="category"></bn-table>`;
  const card =
    `<bn-layout-card slot="slot-0" card-layout="full" card-fit-to-content="true">` +
    `<div slot="card-slot-0" data-bino-annotation-target="t">${table}</div></bn-layout-card>`;
  const items = [
    { label: "1", target: "t", point: { category: "Row0" } },
    { label: "2", target: "t", point: { category: "Row9" } },
  ];
  const page = await openDeep(
    data +
      pageOf([card, slot(1, "other", TIME)], items, 'page-format="xga" page-orientation="landscape"')
        .replace('page-layout="2x2"', 'page-layout="split-horizontal"')
        .replace("$sales", "$t"),
  );

  assert.deepEqual(
    (await drawnMarks(page)).map((mark) => mark.label),
    ["1"],
  );
});

test("list: dropping a circle does not change the place of the text", async () => {
  const entries = [
    { label: "1", title: "placed", html: "text" },
    { label: "2", title: "not placed", html: "text" },
  ];
  const items = [
    { label: "1", target: "structure", point: { category: "Software", scenario: "ac1" } },
    { label: "2", target: "structure", point: { category: "Nope", scenario: "ac1" } },
  ];
  const page = await openDeep(
    DATA +
      pageOf(
        [
          FIXTURE_SLOTS[1],
          `<div slot="slot-2"><bn-annotation-list items="${esc(JSON.stringify(entries))}"></bn-annotation-list></div>`,
        ],
        items,
      ),
  );
  const result = await page.$eval("bn-annotation-list", (el) =>
    [...el.shadowRoot.querySelectorAll("li")].map((li) => ({
      left: li.querySelector(".text").getBoundingClientRect().left,
      height: li.getBoundingClientRect().height,
    })),
  );
  assert.equal(result[0].left, result[1].left);
  assert.equal(result[0].height, result[1].height);
});

test("items: a value of the wrong type costs that value, not the other marks", async () => {
  const items = [
    { label: 1, target: "structure", point: { category: "Software", scenario: "ac1" } },
    {
      label: { $tag$: "img", $attrs$: { src: "x" } },
      color: true,
      target: "structure",
      point: { category: "Hardware", scenario: "ac1" },
    },
    { label: "3", target: "structure", point: { category: "Nope", scenario: "ac1" } },
  ];
  const list = [
    { label: { $tag$: "img", $attrs$: { src: "x" } }, title: { $tag$: "img", $attrs$: { src: "x" } } },
    { label: 3, title: "gone" },
  ];
  const page = await openDeep(
    DATA +
      pageOf(
        [
          FIXTURE_SLOTS[1],
          `<div slot="slot-1"><bn-annotation-list items="${esc(JSON.stringify(list))}"></bn-annotation-list></div>`,
        ],
        items,
      ),
  );

  assert.deepEqual(
    (await drawnMarks(page)).map((mark) => mark.label),
    ["1", null],
  );
  const result = await page.$eval("bn-annotation-list", (el) => ({
    images: el.shadowRoot.querySelectorAll("img").length,
    badges: el.shadowRoot.querySelectorAll(".badge").length,
  }));
  assert.deepEqual(result, { images: 0, badges: 0 });
});

test("layout state: a layer with broken items reports it on bn-context", async () => {
  const { page } = await open(
    `<bn-layout-page><bn-annotation-layer slot="annotations" items="not json"></bn-annotation-layer></bn-layout-page>`,
  );
  const ids = await page.evaluate(async () => {
    const state = await document.querySelector("bn-context").getLayoutState();
    return state.components.find((c) => c.tag === "bn-annotation-layer").diagnostics.map((d) => d.id);
  });
  assert.deepEqual(ids, ["ERR_items"]);
});

test("re-attach: the list shows the circles of the page it is on now", async () => {
  const items = [{ label: "1", target: "structure", point: { category: "Nope", scenario: "ac1" } }];
  const list = `<bn-annotation-list items="${esc(JSON.stringify([{ label: "1", title: "x" }]))}"></bn-annotation-list>`;
  const page = await openDeep(
    DATA +
      pageOf([FIXTURE_SLOTS[1]], items) +
      `<bn-layout-page><div slot="slot-0" id="other">${list}</div></bn-layout-page>`,
  );
  const badges = () => page.$eval("bn-annotation-list", (el) => el.shadowRoot.querySelectorAll(".badge").length);
  assert.equal(await badges(), 1);

  await page.evaluate(() => {
    const element = document.querySelector("bn-annotation-list");
    const target = document.querySelector("bn-layout-page");
    const cell = document.createElement("div");
    cell.slot = "slot-1";
    target.append(cell);
    cell.append(element);
  });
  await until(
    page,
    () => document.querySelector("bn-annotation-list").shadowRoot.querySelectorAll(".badge").length === 0,
  );
});

test("slot: a page without annotations is unchanged", async () => {
  const page = await openDeep(DATA + `<bn-layout-page>${slot(0, "time", TIME)}</bn-layout-page>`);
  const result = await page.evaluate(() => ({
    assigned: document
      .querySelector("bn-layout-page")
      .shadowRoot.querySelector('slot[name="annotations"]')
      .assignedElements().length,
    layers: document.querySelectorAll("bn-annotation-layer").length,
  }));
  assert.deepEqual(result, { assigned: 0, layers: 0 });
});
