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
jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const { SYSTEM_I18N_DEFAULTS } = require("../../stores/internationalization");
  const { createScopedDb } = require("../../context/scopedDb");

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
import { getStores } from "../../context/context-protocol";
import { IbcsTable } from "./ibcs-table";
import { OrderDirection, TableType } from "./utils/model";
import { I18nMode } from "../../utils/constants";
import { Order, OrderColumn } from "../../utils/model/Order";

describe("IBCS Table waterfall bar columns", () => {
  const cascadeRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, date: "2023-02-01", ac1: 10, pl1: 8 },
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, date: "2024-02-01", ac1: 5, pl1: 4 },
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

  const i18n = new Map([
    ["SUM_TOTAL", "Summe"],
    ["there_of", "davon"],
    ["part_of", "anteil an"],
  ]);

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["cascadeData"] = { data: cascadeRows };
    tables["thereofData"] = { data: thereofRows };
    tables["optData"] = { data: optRows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [IbcsTable],
      template: () => (
        <ibcs-table
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
        ></ibcs-table>
      ),
    });

  const bodyRows = (page: SpecPage): Element[] => Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"));

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    bodyRows(page).find((row) => row.querySelector("td")?.textContent.trim() === text);

  const waterfallSvg = (row: Element): Element | undefined =>
    Array.from(row.querySelectorAll("svg")).find((svg) => (svg.getAttribute("class") || "").includes("waterfall-bar"));

  // the bar rect is a direct child of the svg; pattern rects live inside <defs>
  const barRect = (svg: Element): Element | undefined =>
    Array.from(svg.querySelectorAll("rect")).find(
      (rect) => (rect.parentNode as Element).tagName?.toLowerCase() === "svg",
    );

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

  it("sub-cascades thereof rows across the parent bar with dashed extent guides", async () => {
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

    const guides = Array.from(drillSvg.querySelectorAll("line")).filter((line) =>
      line.getAttribute("stroke-dasharray"),
    );
    expect(guides.length).toBe(2);
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
});
