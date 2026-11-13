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

describe("IBCS Table interval columns", () => {
  const yearRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "Umsatz", rowGroupIndex: 0, category: "Hamburg", categoryIndex: 1, subCategory: "Nord", date: "2023-03-10", ac1: 10, pl1: 8 },
    // prettier-ignore
    { operation: "+", rowGroup: "Umsatz", rowGroupIndex: 0, category: "Hamburg", categoryIndex: 1, subCategory: "Nord", date: "2024-05-20", ac1: 20, pl1: 25 },
    // prettier-ignore
    { operation: "+", rowGroup: "Umsatz", rowGroupIndex: 0, category: "München", categoryIndex: 2, subCategory: "Ost", date: "2023-07-01", ac1: 5, pl1: 5 },
    // prettier-ignore
    { operation: "+", rowGroup: "Umsatz", rowGroupIndex: 0, category: "München", categoryIndex: 2, subCategory: "Ost", date: "2024-02-15", ac1: 7, pl1: 4 },
  ];

  const monthRows: any[] = [
    { operation: "+", category: "Hamburg", categoryIndex: 1, date: "2023-03-05", ac1: 1 },
    { operation: "+", category: "Hamburg", categoryIndex: 1, date: "2023-03-25", ac1: 2 },
    { operation: "+", category: "Hamburg", categoryIndex: 1, date: "2023-04-02", ac1: 4 },
  ];

  const setRows: any[] = [
    { operation: "+", category: "Hamburg", categoryIndex: 1, setname: "de", ac1: 1 },
    { operation: "+", category: "Hamburg", categoryIndex: 1, setname: "at", ac1: 2 },
    { operation: "+", category: "Hamburg", categoryIndex: 1, setname: "", ac1: 4 },
  ];

  const groupedRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "Umsatz", rowGroupIndex: 0, category: "Hamburg", categoryIndex: 1, date: "2023-03-10", ac1: 10 },
    // prettier-ignore
    { operation: "+", rowGroup: "Umsatz", rowGroupIndex: 0, category: "Hamburg", categoryIndex: 1, date: "2024-05-20", ac1: 20 },
    // prettier-ignore
    { operation: "+", rowGroup: "Umsatz", rowGroupIndex: 0, category: "München", categoryIndex: 2, date: "2023-07-01", ac1: 5 },
    // prettier-ignore
    { operation: "+", rowGroup: "Umsatz", rowGroupIndex: 0, category: "München", categoryIndex: 2, date: "2024-02-15", ac1: 7 },
    // prettier-ignore
    { operation: "+", rowGroup: "Kosten", rowGroupIndex: 1, category: "Personal", categoryIndex: 1, date: "2023-04-01", ac1: 3 },
    // prettier-ignore
    { operation: "+", rowGroup: "Kosten", rowGroupIndex: 1, category: "Personal", categoryIndex: 1, date: "2024-04-01", ac1: 4 },
  ];

  const sparseRows: any[] = [
    { operation: "+", category: "Hamburg", categoryIndex: 1, date: "2023-03-10", ac1: 10 },
    { operation: "+", category: "Hamburg", categoryIndex: 1, date: "2024-05-20", ac1: 20 },
    { operation: "+", category: "Leipzig", categoryIndex: 2, date: "2023-06-01", ac1: 3 },
  ];

  // one year; limit 1 shows Berlin, REST is Hamburg and Köln
  const restVarianceRows: any[] = [
    { operation: "+", category: "Berlin", categoryIndex: 1, date: "2024-03-10", ac1: 200, fc1: 180, pp1: 150 },
    { operation: "+", category: "Hamburg", categoryIndex: 2, date: "2024-05-20", ac1: 50, fc1: 40, pp1: 60 },
    { operation: "+", category: "Köln", categoryIndex: 3, date: "2024-07-01", ac1: 40, fc1: 35, pp1: 40 },
  ];

  const i18n = new Map([
    ["SUM_TOTAL", "Summe"],
    ["thereof", "davon"],
    ["part_of", "anteil an"],
  ]);

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["yearData"] = { data: yearRows };
    tables["monthData"] = { data: monthRows };
    tables["setData"] = { data: setRows };
    tables["groupedData"] = { data: groupedRows };
    tables["sparseData"] = { data: sparseRows };
    tables["restVarianceData"] = { data: restVarianceRows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1"]}
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
          tableName="yearData"
          interval="year"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const headerRows = (page: SpecPage): Element[] => Array.from(page.root.shadowRoot.querySelectorAll("thead tr"));

  const bandCells = (page: SpecPage): Element[] => Array.from(headerRows(page)[0].querySelectorAll("th"));

  const cellTexts = (row: Element): string[] =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim());

  const findRowByFirstCell = (page: SpecPage, text: string): Element =>
    Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find(
      (row) => row.querySelector("td")?.textContent.trim() === text,
    );

  it("renders a spanning band row with one label per bucket", async () => {
    const page = await renderTable({ scenarios: ["ac1", "pl1"] });

    expect(headerRows(page).length).toBe(3);

    const cells = bandCells(page);
    expect(cells.map((cell) => cell.textContent.trim())).toEqual(["", "2023", "2024"]);
    // category filler spans one column, each year spans the two scenario columns
    expect(cells[0].getAttribute("class")).toContain("filler");
    expect(cells[0].getAttribute("colspan")).toBe("1");
    expect(cells[1].getAttribute("class")).toContain("intervalGroup");
    expect(cells[1].getAttribute("colspan")).toBe("2");
    expect(cells[2].getAttribute("colspan")).toBe("2");
  });

  it("starts a block at every bucket, in the band row and in the rows below it", async () => {
    const page = await renderTable({ scenarios: ["ac1", "pp1"] });
    const isStart = (cell: Element) => cell.classList.contains("block-start");

    // the band cells span the two scenarios of a bucket, so the column of a cell is not its index
    const band = bandCells(page);
    expect(band.slice(1).every((cell) => cell.getAttribute("colspan") === "2")).toBe(true);
    expect(band.map(isStart)).toEqual([false, ...band.slice(1).map(() => true)]);

    // category | AC PY | AC PY | ...: the first scenario of every bucket
    const labels = Array.from(headerRows(page)[1].querySelectorAll("th"));
    expect(labels.map(isStart)).toEqual(labels.map((_, i) => i > 0 && i % 2 === 1));
    const body = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr:first-child td"));
    expect(body.map(isStart)).toEqual(labels.map(isStart));
  });

  it("renders no band row when interval is none", async () => {
    const page = await renderTable({ interval: "none" });

    expect(headerRows(page).length).toBe(2);
  });

  it("renders per-year entry values and a per-year total row", async () => {
    const page = await renderTable();

    expect(cellTexts(findRowByFirstCell(page, "Hamburg"))).toEqual(["Hamburg", "10.0", "20.0"]);
    expect(cellTexts(findRowByFirstCell(page, "München"))).toEqual(["München", "5.0", "7.0"]);
    expect(cellTexts(findRowByFirstCell(page, "Summe"))).toEqual(["Summe", "15.0", "27.0"]);
  });

  it("aggregates dates of the same month into one bucket", async () => {
    const page = await renderTable({ tableName: "monthData", interval: "month" });

    expect(bandCells(page).map((cell) => cell.textContent.trim())).toEqual(["", "Mar 2023", "Apr 2023"]);
    expect(cellTexts(findRowByFirstCell(page, "Hamburg"))).toEqual(["Hamburg", "3.0", "4.0"]);
  });

  it("groups by setname in order of first appearance, blanks under -", async () => {
    const page = await renderTable({ tableName: "setData", interval: "setname" });

    expect(bandCells(page).map((cell) => cell.textContent.trim())).toEqual(["", "de", "at", "-"]);
    expect(cellTexts(findRowByFirstCell(page, "Hamburg"))).toEqual(["Hamburg", "1.0", "2.0", "4.0"]);
  });

  it("renders per-bucket group sums when grouped", async () => {
    const page = await renderTable({ tableName: "groupedData", grouped: true, showGroupTitle: true });

    const sumRows = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).filter((row) =>
      row.getAttribute("class")?.includes("sum"),
    );

    expect(sumRows.map((row) => cellTexts(row))).toEqual([
      ["Umsatz", "15.0", "27.0"],
      ["Kosten", "3.0", "4.0"],
      ["Summe", "18.0", "31.0"],
    ]);
  });

  it("computes per-bucket REST values from the not-displayed categories", async () => {
    const page = await renderTable({
      limit: 1,
      order: { hierarchy: ["ac1"], direction: OrderDirection.DESC } as Order,
    });

    expect(cellTexts(findRowByFirstCell(page, "Hamburg"))).toEqual(["Hamburg", "10.0", "20.0"]);
    expect(cellTexts(findRowByFirstCell(page, "REST"))).toEqual(["REST", "5.0", "7.0"]);
    expect(cellTexts(findRowByFirstCell(page, "Summe"))).toEqual(["Summe", "15.0", "27.0"]);
  });

  it("counts a reference shared by two relative variances once in the REST row", async () => {
    const props = {
      tableName: "restVarianceData",
      type: TableType.LIST,
      scenarios: ["ac1", "fc1", "pp1", "drac1_pp1_pos", "drfc1_pp1_pos"],
      limit: 1,
    };
    // REST: ac1 50 + 40 = 90, fc1 40 + 35 = 75, pp1 60 + 40 = 100
    // (90 - 100) / |100| = -10%, (75 - 100) / |100| = -25%
    const rest = ["REST", "100.0", "75.0", "90.0", "-10.00%", "-25.00%"];

    expect(cellTexts(findRowByFirstCell(await renderTable(props), "REST"))).toEqual(rest);
    // the table without interval prints the same
    expect(cellTexts(findRowByFirstCell(await renderTable({ ...props, interval: "none" }), "REST"))).toEqual(rest);
  });

  it("renders - for categories without rows in a bucket", async () => {
    const page = await renderTable({ tableName: "sparseData" });

    expect(cellTexts(findRowByFirstCell(page, "Leipzig"))).toEqual(["Leipzig", "3.0", "-"]);
  });

  it("computes absolute variances per bucket", async () => {
    const page = await renderTable({ scenarios: ["ac1", "dac1_pl1_pos"] });

    // per year: AC then ΔPL (10-8=2, 20-25=-5 | 5-5=0, 7-4=3)
    expect(cellTexts(findRowByFirstCell(page, "Hamburg"))).toEqual(["Hamburg", "10.0", "2.0", "20.0", "-5.0"]);
    expect(cellTexts(findRowByFirstCell(page, "München"))).toEqual(["München", "5.0", "0.0", "7.0", "3.0"]);
  });

  it("divides relative variances per bucket", async () => {
    const page = await renderTable({ scenarios: ["ac1", "drac1_pl1_pos"] });

    // 2023: (10-8)/8 = 25% -- 2024: (20-25)/25 = -20%
    const hamburg = cellTexts(findRowByFirstCell(page, "Hamburg"));
    expect(hamburg[2]).toContain("25");
    expect(hamburg[4]).toContain("-20");
  });

  it("renders bar charts scaled by bucket values", async () => {
    const page = await renderTable({
      scenarios: ["ac1", "dac1_pl1_pos"],
      barColumns: ["dac1_pl1_pos"],
    });

    const hamburg = findRowByFirstCell(page, "Hamburg");
    const barCells = Array.from(hamburg.querySelectorAll("td")).filter((cell) => cell.querySelector("svg"));
    expect(barCells.length).toBe(2); // one ΔPL bar per year
  });

  describe("one scale per unit across the buckets", () => {
    // per category, the bar svgs of 2023 and 2024
    const barSvgs = (page: SpecPage, category: string): Element[] =>
      Array.from(findRowByFirstCell(page, category).querySelectorAll("svg"));

    const directChild = (svg: Element, tag: string): Element =>
      Array.from(svg.children).find((el) => el.tagName.toLowerCase() === tag);

    // the PL axis is a double line around the axis
    const axisXOf = (svg: Element): number => {
      const lines = Array.from(svg.querySelectorAll("g.variance-axis line"));
      return lines.reduce((sum, line) => sum + parseFloat(line.getAttribute("x1")), 0) / lines.length;
    };

    const num = (el: Element, attr: string): number => parseFloat(el.getAttribute(attr));

    it("draws the bars of all buckets with one auto unit scale and one axis", async () => {
      const page = await renderTable({
        scenarios: ["ac1", "dac1_pl1_pos"],
        barColumns: ["dac1_pl1_pos"],
        unitScaling: 0,
      });

      // ΔPL: Hamburg +2 | -5, München 0 | +3; only 2024 has a negative value
      const [hamburg2023, hamburg2024] = barSvgs(page, "Hamburg");
      const [, muenchen2024] = barSvgs(page, "München");
      const pxPerUnit = num(directChild(hamburg2024, "rect"), "width") / 5;

      expect(num(directChild(hamburg2023, "rect"), "width") / 2).toBeCloseTo(pxPerUnit, 3);
      expect(num(directChild(muenchen2024, "rect"), "width") / 3).toBeCloseTo(pxPerUnit, 3);
      expect(axisXOf(hamburg2023)).toBeCloseTo(axisXOf(hamburg2024), 3);
    });

    it("draws the pins of all buckets with one auto percentage scale", async () => {
      const page = await renderTable({
        scenarios: ["ac1", "drac1_pl1_pos"],
        barColumns: ["drac1_pl1_pos"],
        percentageScaling: 0,
      });

      // ΔPL%: Hamburg +25% | -20%, München 0% | +75%
      const headOffset = (svg: Element): number => {
        const head = directChild(svg, "rect");
        return Math.abs(num(head, "x") + num(head, "width") / 2 - axisXOf(svg));
      };
      const [hamburg2023, hamburg2024] = barSvgs(page, "Hamburg");
      const [, muenchen2024] = barSvgs(page, "München");
      const pxPerPoint = headOffset(muenchen2024) / 75;

      expect(headOffset(hamburg2023) / 25).toBeCloseTo(pxPerPoint, 3);
      expect(headOffset(hamburg2024) / 20).toBeCloseTo(pxPerPoint, 3);
      expect(axisXOf(hamburg2023)).toBeCloseTo(axisXOf(hamburg2024), 3);
    });

    it("cuts the pins of all buckets at the same length with a fixed percentage scale", async () => {
      const page = await renderTable({
        scenarios: ["ac1", "drac1_pl1_pos"],
        barColumns: ["drac1_pl1_pos"],
        percentageScaling: 2,
      });

      // +25% in 2023 and +75% in 2024 are both beyond the pin area
      const tipOffset = (svg: Element): number => {
        const xs = directChild(svg, "polygon").getAttribute("points").split(" ").map(parseFloat);
        return Math.max(...xs) - axisXOf(svg);
      };
      const [hamburg2023] = barSvgs(page, "Hamburg");
      const [, muenchen2024] = barSvgs(page, "München");

      expect(tipOffset(hamburg2023)).toBeGreaterThan(0);
      expect(tipOffset(hamburg2023)).toBeCloseTo(tipOffset(muenchen2024), 3);
    });
  });

  it("resolves auto to a concrete granularity from the date span", async () => {
    const page = await renderTable({ interval: "auto" });

    // 2023-03-10 .. 2024-05-20 is ~14 months -> month buckets, only where data exists
    expect(bandCells(page).map((cell) => cell.textContent.trim())).toEqual([
      "",
      "Mar 2023",
      "Jul 2023",
      "Feb 2024",
      "May 2024",
    ]);
    expect(cellTexts(findRowByFirstCell(page, "Hamburg"))).toEqual(["Hamburg", "10.0", "-", "-", "20.0"]);
  });

  it("fills thereof drill rows per bucket", async () => {
    const page = await renderTable({
      thereof: [{ rowGroup: "", category: "Hamburg", subCategory: "", partOf: "" }],
    });

    // the drill row's category cell carries the "davon" prefix
    const nord = Array.from(page.root.shadowRoot.querySelectorAll("tbody tr")).find((row) =>
      row.querySelector("td")?.textContent.includes("Nord"),
    );
    expect(cellTexts(nord)[0]).toContain("Nord");
    expect(cellTexts(nord).slice(1)).toEqual(["10.0", "20.0"]);
  });
});
