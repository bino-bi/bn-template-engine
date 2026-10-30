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
  assertSurrounds(marks[4].rect, await boxOf(page, "table", CELL), "frame around a table cell");
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
  assertSameCentre(
    marks[2].circle,
    await boxOf(page, "interval", 'td[data-bn-category="A"][data-bn-date="2024-01-01"]'),
    "bucket cell",
  );
  assertSameCentre(
    marks[3].circle,
    await boxOf(page, "rest", 'td[data-bn-category="REST"][data-bn-scenario="ac1"]'),
    "REST cell",
  );
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
