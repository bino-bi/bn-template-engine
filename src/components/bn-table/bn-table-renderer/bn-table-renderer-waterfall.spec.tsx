// Mock MutationObserver for withComponentStyle mixin
(global as any).MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock scoped stores so the component doesn't walk mock-doc DOM
jest.mock("../../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../../stores/internationalization");
  const { createScopedDb } = require("../../../context/scopedDb");

  const mockStores = {
    db: createScopedDb(),
    datasetsMeta: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
    internationalization: createStore({ ...SYSTEM_I18N_DEFAULTS }),
    assets: createStore({}),
    context: createStore({ locale: "en" }),
  };

  return {
    getStores: () => mockStores,
    getOrCreateStores: () => mockStores,
    clearStoresCache: () => {},
  };
});

import { h } from "@stencil/core";
import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getStores } from "../../../context/context-protocol";
import { BnTableRenderer } from "./bn-table-renderer";
import { OrderDirection, TableType } from "../utils/model";
import { I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";
import { estimateLabelWidth } from "../utils/helper/barColumnGeometry";

describe("IBCS Table waterfall bar columns", () => {
  const cascadeRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, date: "2023-02-01", ac1: 10, pl1: 8, fc1: 7 },
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, date: "2024-02-01", ac1: 5, pl1: 4, fc1: 3 },
  ];

  const thereofRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, subCategory: "A1", ac1: 6 },
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, subCategory: "A2", ac1: 4 },
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, subCategory: "B1", ac1: 5 },
  ];

  const optRows: any[] = [
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, ac1: 10 },
    { operation: "-", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, ac1: 5 },
  ];

  // Beta subtracts 5 of Alpha's 10 and ends close to zero in the near-zero table
  const optThereofRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, subCategory: "A1", ac1: 10 },
    // prettier-ignore
    { operation: "-", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, subCategory: "B1", ac1: 3 },
    // prettier-ignore
    { operation: "-", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, subCategory: "B2", ac1: 2 },
  ];

  const nearZeroRows: any[] = [
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, ac1: 1000 },
    { operation: "-", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, ac1: 990 },
  ];

  const i18n = new Map([
    ["SUM_TOTAL", "Summe"],
    ["thereof", "davon"],
    ["part_of", "anteil an"],
  ]);

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["cascadeData"] = { data: cascadeRows };
    tables["thereofData"] = { data: thereofRows };
    tables["optData"] = { data: optRows };
    tables["optThereofData"] = { data: optThereofRows };
    tables["nearZeroData"] = { data: nearZeroRows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1"]}
          barColumns={["ac1"]}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORY],
              direction: OrderDirection.ASC,
            } as Order
          }
          type={TableType.SUM}
          i18n={i18n}
          i18n-mode={I18nMode.META}
          tableName="cascadeData"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const bodyRows = (page: SpecPage): Element[] => Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"));

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    bodyRows(page).find((row) => row.querySelector("td")?.textContent.trim() === text);

  // an opt table has the operation in the first cell
  const findRowByCell = (page: SpecPage, text: string): Element =>
    bodyRows(page).find((row) => Array.from(row.querySelectorAll("td")).some((td) => td.textContent.trim() === text));

  const waterfallSvg = (row: Element): Element | undefined =>
    Array.from(row.querySelectorAll("svg")).find((svg) => (svg.getAttribute("class") || "").includes("waterfall-bar"));

  // the bar rect is a direct child of the svg; pattern rects live inside <defs>
  const barRect = (svg: Element): Element | undefined =>
    Array.from(svg.querySelectorAll("rect")).find(
      (rect) => (rect.parentNode as Element).tagName?.toLowerCase() === "svg",
    );

  const isConnector = (el: Element): boolean => (el.getAttribute("class") || "").includes("waterfall-connector");

  // the axis (solid) and dashed lines of a row, without the connectors of the walk
  const linesOf = (svg: Element, dashed: boolean): number[] =>
    Array.from(svg.children)
      .filter(
        (el) =>
          el.tagName.toLowerCase() === "line" &&
          !isConnector(el) &&
          (el.getAttribute("stroke-dasharray") !== null) === dashed,
      )
      .map((line) => parseFloat(line.getAttribute("x1")));

  const connectorLines = (svg: Element): Element[] => Array.from(svg.children).filter(isConnector);
  const connectorsOf = (svg: Element): number[] =>
    connectorLines(svg).map((line) => parseFloat(line.getAttribute("x1")));

  const LABEL_FONT = 13.3333 * 0.85;
  /** From and to of the value label in svg px; the spec has no canvas, so the width is the estimate. */
  const labelSpan = (svg: Element): [number, number] => {
    const label = svg.querySelector("text");
    const x = parseFloat(label.getAttribute("x"));
    const bold = (svg.closest("tr").getAttribute("class") || "").includes("sum");
    const width = estimateLabelWidth(label.textContent, LABEL_FONT) * (bold ? 1.08 : 1);
    return label.getAttribute("text-anchor") === "end" ? [x - width, x] : [x, x + width];
  };

  const xOf = (el: Element): number => parseFloat(el.getAttribute("x"));
  const widthOf = (el: Element): number => parseFloat(el.getAttribute("width"));

  it("cascades scenario bars from the running total on a sum table", async () => {
    const page = await renderTable();

    const alpha = barRect(waterfallSvg(findRowByFirstCell(page, "Alpha")));
    const beta = barRect(waterfallSvg(findRowByFirstCell(page, "Beta")));

    // Alpha [0,10], Beta [10,15]: Beta starts where Alpha ends, at half its width
    expect(xOf(beta)).toBeCloseTo(xOf(alpha) + widthOf(alpha), 3);
    expect(widthOf(beta)).toBeCloseTo(widthOf(alpha) / 2, 3);
  });

  it("anchors the total row at zero and renders its bar", async () => {
    const page = await renderTable();

    const alpha = barRect(waterfallSvg(findRowByFirstCell(page, "Alpha")));
    const summeSvg = waterfallSvg(findRowByFirstCell(page, "Summe"));
    expect(summeSvg).toBeDefined();

    // Summe [0,15] starts at the axis like Alpha [0,10] and spans the full extent
    const summe = barRect(summeSvg);
    expect(xOf(summe)).toBeCloseTo(xOf(alpha), 3);
    expect(widthOf(summe)).toBeCloseTo(widthOf(alpha) * 1.5, 3);
  });

  it("sub-cascades thereof rows across the parent bar and joins them with connectors", async () => {
    const page = await renderTable({
      tableName: "thereofData",
      thereof: [{ rowGroup: "", category: "Alpha", subCategory: "A1", partOf: "" }],
    });

    const drillRow = bodyRows(page).find((row) => (row.getAttribute("class") || "").includes("ofit"));
    const drillSvg = waterfallSvg(drillRow);
    expect(drillSvg).toBeDefined();

    // parent Alpha [0,10], drill A1 [0,6]
    const alpha = barRect(waterfallSvg(findRowByFirstCell(page, "Alpha")));
    const drill = barRect(drillSvg);
    expect(xOf(drill)).toBeCloseTo(xOf(alpha), 3);
    expect(widthOf(drill)).toBeCloseTo(widthOf(alpha) * 0.6, 3);

    // no dashed guides: a line from the start of Alpha into A1, and the walk from the end of Alpha on to Beta beside A1
    expect(linesOf(drillSvg, true).length).toBe(0);
    const joins = connectorsOf(drillSvg);
    expect(joins.some((x) => Math.abs(x - xOf(alpha)) < 1e-3)).toBe(true);
    expect(joins.some((x) => Math.abs(x - (xOf(alpha) + widthOf(alpha))) < 1e-3)).toBe(true);
  });

  const drillSvgs = (page: SpecPage): Element[] =>
    bodyRows(page)
      .filter((row) => (row.getAttribute("class") || "").includes("ofit"))
      .map((row) => waterfallSvg(row));

  it("interrupts a connector where it would run through a label", async () => {
    for (const props of [
      {
        tableName: "thereofData",
        thereof: [
          { rowGroup: "", category: "Alpha", subCategory: "A1", partOf: "" },
          { rowGroup: "", category: "Alpha", subCategory: "A2", partOf: "" },
        ],
      },
      {
        tableName: "optThereofData",
        type: TableType.OPT,
        thereof: [
          { rowGroup: "", category: "Beta", subCategory: "B1", partOf: "" },
          { rowGroup: "", category: "Beta", subCategory: "B2", partOf: "" },
        ],
      },
    ]) {
      const page = await renderTable({ ...props, barColumnMaxWidth: 5 });
      for (const svg of drillSvgs(page)) {
        const [from, to] = labelSpan(svg);
        const height = parseFloat(svg.getAttribute("height"));
        const fontSize = parseFloat(svg.querySelector("text").getAttribute("font-size"));
        for (const line of connectorLines(svg)) {
          const x = parseFloat(line.getAttribute("x1"));
          if (x <= from || x >= to) continue;
          const [y1, y2] = [parseFloat(line.getAttribute("y1")), parseFloat(line.getAttribute("y2"))];
          // the part over the label text is left out
          expect(y2 <= height / 2 - fontSize / 2 + 1e-6 || y1 >= height / 2 + fontSize / 2 - 1e-6).toBe(true);
        }
      }
    }
  });

  it("leaves out the zero axis in a row where it would meet the label", async () => {
    const page = await renderTable({ tableName: "nearZeroData", type: TableType.OPT });

    // Beta [1000,10] ends just right of zero, its label sits over the axis
    const alpha = waterfallSvg(findRowByCell(page, "Alpha"));
    const beta = waterfallSvg(findRowByCell(page, "Beta"));
    expect(linesOf(alpha, false).length).toBe(1);
    expect(linesOf(alpha, false)[0]).toBeCloseTo(xOf(barRect(alpha)), 3);
    expect(linesOf(beta, false).length).toBe(0);
  });

  it.each([15, 20, 30])("keeps every label inside the column at w%i", async (n) => {
    for (const props of [
      { tableName: "optData", type: TableType.OPT },
      { tableName: "nearZeroData", type: TableType.OPT },
      { tableName: "thereofData", thereof: [{ rowGroup: "", category: "Alpha", subCategory: "A1", partOf: "" }] },
    ]) {
      const page = await renderTable({ ...props, barColumnMaxWidth: n });
      const svgs = bodyRows(page)
        .map((row) => waterfallSvg(row))
        .filter(Boolean);
      expect(svgs.length).toBeGreaterThan(0);
      for (const svg of svgs) {
        const [from, to] = labelSpan(svg);
        expect(from).toBeGreaterThanOrEqual(-1e-6);
        expect(to).toBeLessThanOrEqual(widthOf(svg) + 1e-6);
      }
    }
  });

  it("gives the bars the room no label needs", async () => {
    const page = await renderTable({ barColumnMaxWidth: 15 });

    // all bars point right: no gutter on the left, the longest label ends at the right edge
    const alpha = waterfallSvg(findRowByFirstCell(page, "Alpha"));
    expect(xOf(barRect(alpha))).toBeCloseTo(0, 6);
    const ends = bodyRows(page)
      .map((row) => waterfallSvg(row))
      .filter(Boolean)
      .map((svg) => labelSpan(svg)[1]);
    expect(Math.max(...ends)).toBeCloseTo(parseFloat(alpha.getAttribute("width")), 3);
  });

  it("scales partof segments by their share of the parent bar and keeps the percent label", async () => {
    const page = await renderTable({
      partof: [{ rowGroup: "", category: "Alpha", subCategory: "", partOf: "SUM_TOTAL" }],
    });

    const partRow = bodyRows(page).find((row) => (row.getAttribute("class") || "").includes("partof"));
    const partSvg = waterfallSvg(partRow);
    expect(partSvg).toBeDefined();

    // parent Alpha [0,10], share 10/15 -> segment [0, 6.67]
    const alpha = barRect(waterfallSvg(findRowByFirstCell(page, "Alpha")));
    const part = barRect(partSvg);
    expect(xOf(part)).toBeCloseTo(xOf(alpha), 3);
    expect(widthOf(part)).toBeCloseTo((widthOf(alpha) * 2) / 3, 3);
    expect(partSvg.querySelector("text").textContent).toContain("%");
  });

  it("keeps axis-anchored bars on a flat list table without grouping structure", async () => {
    const page = await renderTable({ type: TableType.LIST });

    const svgs = Array.from(page.root.shadowRoot.querySelectorAll("tbody svg"));
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((svg) => (svg.getAttribute("class") || "").includes("absolute-variance"))).toBe(true);
  });

  it("keeps variance bar columns unchanged and bar-free on sum rows", async () => {
    const page = await renderTable({ scenarios: ["ac1", "dac1_pl1_pos"], barColumns: ["dac1_pl1_pos"] });

    const alphaSvgs = Array.from(findRowByFirstCell(page, "Alpha").querySelectorAll("svg"));
    expect(alphaSvgs.length).toBe(1);
    expect(alphaSvgs[0].getAttribute("class")).toContain("absolute-variance");

    expect(findRowByFirstCell(page, "Summe").querySelector("svg")).toBeNull();
  });

  it("does not render waterfalls for interval bucket columns", async () => {
    const page = await renderTable({ interval: "year" });

    const svgs = Array.from(page.root.shadowRoot.querySelectorAll("tbody svg"));
    expect(svgs.some((svg) => (svg.getAttribute("class") || "").includes("waterfall-bar"))).toBe(false);
  });

  it("steps subtracting opt rows back to the left", async () => {
    const page = await renderTable({ tableName: "optData", type: TableType.OPT });

    const rects = bodyRows(page)
      .map((row) => waterfallSvg(row))
      .filter(Boolean)
      .map((svg) => barRect(svg));
    expect(rects.length).toBe(3); // Alpha, Beta, Summe

    // Alpha [0,10], Beta [10,5]: Beta ends at Alpha's end, going back half its width
    const [alpha, beta] = rects;
    expect(xOf(beta) + widthOf(beta)).toBeCloseTo(xOf(alpha) + widthOf(alpha), 3);
    expect(widthOf(beta)).toBeCloseTo(widthOf(alpha) / 2, 3);
  });

  // a bar with a white or transparent fill and no stroke cannot be seen on the white table
  const isVisible = (rect: Element): boolean =>
    !["#ffffff", "transparent"].includes(rect.getAttribute("fill")) || rect.getAttribute("stroke") !== "none";

  it("draws the FC waterfall bar hatched", async () => {
    const page = await renderTable({ scenarios: ["fc1"], barColumns: ["fc1"] });

    const svg = waterfallSvg(findRowByFirstCell(page, "Alpha"));
    const bar = barRect(svg);

    // the default FC style has the stroke #404040 and the fill pattern "fc"
    expect(bar.getAttribute("fill")).toBe("url(#pattern-fc-404040)");
    expect(svg.querySelector("pattern#pattern-fc-404040")).not.toBeNull();
    expect(isVisible(bar)).toBe(true);
  });

  it("draws the FC bar of a list table hatched", async () => {
    const page = await renderTable({ scenarios: ["fc1"], barColumns: ["fc1"], type: TableType.LIST });

    const svg = findRowByFirstCell(page, "Alpha").querySelector("svg.absolute-variance");
    const bar = barRect(svg);

    expect(bar.getAttribute("fill")).toBe("url(#pattern-fc-404040)");
    expect(svg.querySelector("pattern#pattern-fc-404040")).not.toBeNull();
    expect(isVisible(bar)).toBe(true);
  });
});
