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
import { OrderDirection, TableType, ThereofPosition } from "../utils/model";
import { I18nMode } from "../../../utils/constants";
import { Order, OrderColumn } from "../../../utils/model/Order";
import { estimateLabelWidth } from "../utils/helper/barColumnGeometry";

describe("IBCS Table variance waterfall", () => {
  const VARIANCE = "dac1_pl1_op";

  // variances: Alpha +4, Beta +3 (an expense, so it lowers the result), Gamma -1 (an expense that got cheaper)
  const rows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, date: "2023-02-01", ac1: 14, pl1: 10, fc1: 14, pp1: 10 },
    // prettier-ignore
    { operation: "-", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, date: "2023-02-01", ac1: 8, pl1: 5, fc1: 8, pp1: 5 },
    // prettier-ignore
    { operation: "-", rowGroup: "G", rowGroupIndex: 0, category: "Gamma", categoryIndex: 3, date: "2023-02-01", ac1: 3, pl1: 4, fc1: 3, pp1: 4 },
  ];

  // Beta split in a child that got worse by 5 and one that got better by 2
  const thereofRows: any[] = [
    // prettier-ignore
    { operation: "+", rowGroup: "G", rowGroupIndex: 0, category: "Alpha", categoryIndex: 1, subCategory: "A", ac1: 14, pl1: 10 },
    // prettier-ignore
    { operation: "-", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, subCategory: "B1", ac1: 7, pl1: 2 },
    // prettier-ignore
    { operation: "-", rowGroup: "G", rowGroupIndex: 0, category: "Beta", categoryIndex: 2, subCategory: "B2", ac1: 1, pl1: 3 },
  ];

  // two row groups: the second one only has an expense
  const groupRows: any[] = [
    { operation: "+", rowGroup: "G1", rowGroupIndex: 1, category: "Alpha", categoryIndex: 1, ac1: 14, pl1: 10 },
    { operation: "-", rowGroup: "G2", rowGroupIndex: 2, category: "Beta", categoryIndex: 2, ac1: 8, pl1: 5 },
  ];

  // variances: Sales +10, CostA +3, CostB +2, CostC +1, Other +4
  const restRows: any[] = [
    { operation: "+", category: "Sales", categoryIndex: 1, ac1: 20, pl1: 10 },
    { operation: "-", category: "CostA", categoryIndex: 2, ac1: 8, pl1: 5 },
    { operation: "-", category: "CostB", categoryIndex: 3, ac1: 6, pl1: 4 },
    { operation: "-", category: "CostC", categoryIndex: 4, ac1: 5, pl1: 4 },
  ];
  const mixedRestRows: any[] = [...restRows, { operation: "+", category: "Other", categoryIndex: 5, ac1: 9, pl1: 5 }];

  // variances +50, -45: the second bar ends close to the axis, its label stands on it
  const returnRows: any[] = [
    { operation: "+", category: "Up", categoryIndex: 1, ac1: 150, pl1: 100 },
    { operation: "+", category: "Down", categoryIndex: 2, ac1: 55, pl1: 100 },
  ];

  // Products +150 with Software +140 as its only listed part, Services -20
  const partRows: any[] = [
    { operation: "+", category: "Products", categoryIndex: 1, subCategory: "Software", ac1: 240, pl1: 100 },
    { operation: "+", category: "Products", categoryIndex: 1, subCategory: "Hardware", ac1: 10, pl1: 0 },
    { operation: "+", category: "Services", categoryIndex: 2, subCategory: "S", ac1: 80, pl1: 100 },
  ];

  // no row differs from its plan
  const zeroRows: any[] = [
    { operation: "+", category: "Alpha", categoryIndex: 1, ac1: 10, pl1: 10 },
    { operation: "+", category: "Beta", categoryIndex: 2, ac1: 5, pl1: 5 },
  ];

  const i18n = new Map([
    ["SUM_TOTAL", "Summe"],
    ["thereof", "davon"],
    ["part_of", "anteil an"],
  ]);

  beforeAll(() => {
    const tables = getStores(null).db.db.tables;
    tables["varianceWalk"] = { data: rows };
    tables["varianceWalkThereof"] = { data: thereofRows };
    tables["varianceWalkGroups"] = { data: groupRows };
    tables["varianceWalkRest"] = { data: restRows };
    tables["varianceWalkMixedRest"] = { data: mixedRestRows };
    tables["varianceWalkZero"] = { data: zeroRows };
    tables["varianceWalkReturn"] = { data: returnRows };
    tables["varianceWalkPart"] = { data: partRows };
  });

  const renderTable = (extraProps: Record<string, unknown> = {}): Promise<SpecPage> =>
    newSpecPage({
      components: [BnTableRenderer],
      template: () => (
        <bn-table-renderer
          scenarios={["ac1", VARIANCE]}
          barColumns={[VARIANCE]}
          varianceWaterfall={true}
          measure-scale="_"
          order={
            {
              hierarchy: [OrderColumn.CATEGORYINDEX],
              direction: OrderDirection.ASC,
            } as Order
          }
          type={TableType.OPT}
          i18n={i18n}
          i18n-mode={I18nMode.META}
          tableName="varianceWalk"
          {...extraProps}
        ></bn-table-renderer>
      ),
    });

  const bodyRows = (page: SpecPage): Element[] => Array.from(page.root.shadowRoot.querySelectorAll("tbody tr"));
  const rowOf = (page: SpecPage, text: string): Element =>
    bodyRows(page).find((row) => Array.from(row.querySelectorAll("td")).some((td) => td.textContent.trim() === text));
  const classOf = (el: Element): string => el.getAttribute("class") || "";
  const svgOf = (row: Element): Element | undefined =>
    Array.from(row.querySelectorAll("svg")).find((svg) => classOf(svg).includes("cell-bar-chart"));
  const barRect = (svg: Element): Element =>
    Array.from(svg.querySelectorAll("rect")).find(
      (rect) => (rect.parentNode as Element).tagName?.toLowerCase() === "svg",
    );
  const num = (el: Element, attribute: string): number => parseFloat(el.getAttribute(attribute));
  const from = (svg: Element): number => num(barRect(svg), "x");
  const to = (svg: Element): number => from(svg) + num(barRect(svg), "width");
  const label = (svg: Element): Element => svg.querySelector("text");
  const axisX = (svg: Element): number => {
    const xs = Array.from(svg.querySelectorAll(".variance-axis line")).map((line) => num(line, "x1"));
    return xs.reduce((sum, x) => sum + x, 0) / xs.length;
  };
  /** Connector lines as [x, y1, y2]. */
  const connectors = (svg: Element): number[][] =>
    Array.from(svg.querySelectorAll("line.waterfall-connector")).map((line) => [
      num(line, "x1"),
      num(line, "y1"),
      num(line, "y2"),
    ]);
  const HEIGHT = 18;

  it("keeps plain bars from the axis and no bar on the sum row without the prop", async () => {
    const page = await renderTable({ varianceWaterfall: false });

    expect(classOf(svgOf(rowOf(page, "Beta")))).toContain("absolute-variance");
    expect(svgOf(rowOf(page, "Summe"))).toBeUndefined();
    expect(page.root.shadowRoot.querySelector(".waterfall-bar")).toBeNull();
  });

  it("walks down the rows: a '-' row with a positive variance moves left", async () => {
    const page = await renderTable();
    const [alpha, beta, gamma, total] = ["Alpha", "Beta", "Gamma", "Summe"].map((name) => svgOf(rowOf(page, name)));

    for (const svg of [alpha, beta, gamma, total]) {
      expect(classOf(svg)).toContain("variance-waterfall");
    }
    const unit = (to(alpha) - from(alpha)) / 4;
    // Alpha [0,4], Beta [4,1], Gamma [1,2], total [0,2]
    expect(from(alpha)).toBeCloseTo(axisX(alpha), 3);
    expect(to(beta)).toBeCloseTo(to(alpha), 3);
    expect(from(beta)).toBeCloseTo(from(alpha) + unit, 3);
    expect(from(gamma)).toBeCloseTo(from(beta), 3);
    expect(to(gamma)).toBeCloseTo(from(alpha) + 2 * unit, 3);
    expect(from(total)).toBeCloseTo(from(alpha), 3);
    expect(to(total)).toBeCloseTo(to(gamma), 3);
  });

  it("keeps the printed sign in the label, at the free end of the bar", async () => {
    const page = await renderTable({ componentDataFormatDigits: undefined });
    const [beta, gamma, total] = ["Beta", "Gamma", "Summe"].map((name) => svgOf(rowOf(page, name)));

    expect(label(beta).textContent).toMatch(/^\+3/);
    expect(label(beta).getAttribute("text-anchor")).toBe("end");
    expect(num(label(beta), "x")).toBeLessThan(from(beta));
    expect(label(gamma).textContent).toMatch(/^-1/);
    expect(label(gamma).getAttribute("text-anchor")).toBe("start");
    expect(num(label(gamma), "x")).toBeGreaterThan(to(gamma));
    expect(label(total).textContent).toMatch(/^\+2/);
  });

  it("colors by the sentiment of the cell, not by the direction of the bar", async () => {
    const page = await renderTable();
    const fill = (name: string) => barRect(svgOf(rowOf(page, name))).getAttribute("fill");

    expect(fill("Alpha")).toBe(fill("Gamma"));
    expect(fill("Beta")).not.toBe(fill("Alpha"));
    // the plain bars of the same cells have the same colors
    const plain = await renderTable({ varianceWaterfall: false });
    expect(barRect(svgOf(rowOf(plain, "Beta"))).getAttribute("fill")).toBe(fill("Beta"));
    expect(barRect(svgOf(rowOf(plain, "Gamma"))).getAttribute("fill")).toBe(fill("Gamma"));
  });

  it("draws the reference axis at zero in every row", async () => {
    const page = await renderTable();
    const svgs = ["Alpha", "Beta", "Gamma", "Summe"].map((name) => svgOf(rowOf(page, name)));

    for (const svg of svgs) {
      expect(svg.querySelector(".variance-axis.axis-pl")).not.toBeNull();
      expect(axisX(svg)).toBeCloseTo(axisX(svgs[0]), 3);
    }
  });

  it("draws the PY axis and a hatched FC bar", async () => {
    const variance = "dfc1_pp1_op";
    const page = await renderTable({ scenarios: ["fc1", variance], barColumns: [variance] });
    const beta = svgOf(rowOf(page, "Beta"));

    expect(beta.querySelector(".variance-axis.axis-pp")).not.toBeNull();
    expect(barRect(beta).getAttribute("fill")).toMatch(/^url\(#pattern-neg-/);
    expect(barRect(beta).getAttribute("stroke")).not.toBe("none");
  });

  it("joins the end of a bar to the start of the bar below", async () => {
    const page = await renderTable();
    const [alpha, beta, gamma, total] = ["Alpha", "Beta", "Gamma", "Summe"].map((name) => svgOf(rowOf(page, name)));

    // Alpha: from the bar down; Beta: from above to the bar, from the bar down
    expect(connectors(alpha).length).toBe(1);
    const [x, y1, y2] = connectors(alpha)[0];
    expect(x).toBeCloseTo(to(alpha), 3);
    expect(y1).toBeGreaterThan(HEIGHT / 2);
    expect(y2).toBeGreaterThanOrEqual(HEIGHT);

    const [top, bottom] = connectors(beta);
    expect(top[0]).toBeCloseTo(to(alpha), 3);
    // out of the svg, over the border of the row
    expect(top[1]).toBeLessThan(0);
    expect(top[2]).toBeLessThan(HEIGHT / 2);
    expect(bottom[0]).toBeCloseTo(from(beta), 3);

    expect(connectors(gamma)[1][0]).toBeCloseTo(to(gamma), 3);
    expect(connectors(total).length).toBe(1);
    expect(connectors(total)[0][0]).toBeCloseTo(to(total), 3);
  });

  it("leaves relative variance columns as pins", async () => {
    const relative = "drac1_pl1_op";
    const page = await renderTable({ scenarios: ["ac1", VARIANCE, relative], barColumns: [VARIANCE, relative] });
    const classes = Array.from(rowOf(page, "Beta").querySelectorAll("svg.cell-bar-chart")).map(classOf);

    expect(classes.length).toBe(2);
    expect(classes[0]).toContain("variance-waterfall");
    expect(classes[1]).toContain("relative-variance");
  });

  it("has no effect with an interval", async () => {
    const page = await renderTable({ interval: "year" });

    expect(page.root.shadowRoot.querySelector(".waterfall-bar")).toBeNull();
    expect(page.root.shadowRoot.querySelector(".absolute-variance")).not.toBeNull();
  });

  it("does not follow unit scaling", async () => {
    const width = async (unitScaling: number) =>
      num(barRect(svgOf(rowOf(await renderTable({ unitScaling }), "Alpha"))), "width");

    expect(await width(0.5)).toBeCloseTo(await width(0.01), 3);
  });

  it("takes the signed values of a sum table as they are", async () => {
    const variance = "dac1_pl1_pos";
    const page = await renderTable({ type: TableType.SUM, scenarios: ["ac1", variance], barColumns: [variance] });
    const [alpha, beta, gamma, total] = ["Alpha", "Beta", "Gamma", "Summe"].map((name) => svgOf(rowOf(page, name)));

    // Alpha +4, Beta -3, Gamma +1, total +2
    expect(label(beta).textContent).toMatch(/^-3/);
    expect(to(beta)).toBeCloseTo(to(alpha), 3);
    expect(from(gamma)).toBeCloseTo(from(beta), 3);
    expect(from(total)).toBeCloseTo(from(alpha), 3);
    expect(to(total)).toBeCloseTo(to(gamma), 3);
    expect(barRect(beta).getAttribute("fill")).not.toBe(barRect(alpha).getAttribute("fill"));
  });

  describe("a line that meets a label", () => {
    const LABEL_FONT = 13.3333 * 0.85;
    /** The label as [from, to] in x, by the estimate the spec tests measure with. */
    const labelSpan = (svg: Element): number[] => {
      const text = label(svg);
      const width = estimateLabelWidth(text.textContent, LABEL_FONT);
      const x = num(text, "x");
      return text.getAttribute("text-anchor") === "end" ? [x - width, x] : [x, x + width];
    };
    /** Vertical lines of the svg as [x, y1, y2], with the offset of their group. */
    const lines = (svg: Element, selector: string): number[][] =>
      Array.from(svg.querySelectorAll(selector)).map((line) => {
        const shift = /translate\(0,\s*(-?[\d.]+)\)/.exec(
          (line.parentNode as Element).parentElement?.getAttribute("transform") ?? "",
        );
        const dy = shift ? parseFloat(shift[1]) : 0;
        return [num(line, "x1"), num(line, "y1") + dy, num(line, "y2") + dy];
      });
    const crossesMiddle = ([, y1, y2]: number[]): boolean => y1 < HEIGHT / 2 && y2 > HEIGHT / 2;
    const glyphs = [HEIGHT / 2 - LABEL_FONT / 2, HEIGHT / 2 + LABEL_FONT / 2];

    it("interrupts the variance axis over the label and keeps it above and below", async () => {
      const page = await renderTable({ tableName: "varianceWalkReturn", barColumnMaxWidth: 15 });
      const [up, down] = ["Up", "Down"].map((name) => svgOf(rowOf(page, name)));
      const [labelFrom, labelTo] = labelSpan(down);

      // Down goes from 50 back to 5, its label stands left of the bar end, on the axis
      expect(axisX(down)).toBeGreaterThan(labelFrom);
      expect(axisX(down)).toBeLessThan(labelTo);
      const axis = lines(down, ".variance-axis line");
      expect(axis.some(crossesMiddle)).toBe(false);
      expect(axis.some(([, y1, y2]) => y1 < 0 && y2 <= glyphs[0])).toBe(true);
      expect(axis.some(([, y1, y2]) => y1 >= glyphs[1] && y2 >= HEIGHT)).toBe(true);
      // a row whose label is clear of the axis keeps the whole line
      expect(lines(up, ".variance-axis line").every(crossesMiddle)).toBe(true);
    });

    it("interrupts a passing connector over the label of a thereof row", async () => {
      const page = await renderTable({
        tableName: "varianceWalkPart",
        barColumnMaxWidth: 10,
        thereof: [{ rowGroup: "", category: "Products", subCategory: "Software", partOf: "" }],
      });
      const products = svgOf(rowOf(page, "Products"));
      const software = svgOf(rowOf(page, "davon Software"));
      const [labelFrom, labelTo] = labelSpan(software);

      // the line from the end of Products to Services passes the thereof row inside its label
      expect(to(products)).toBeGreaterThan(labelFrom);
      expect(to(products)).toBeLessThan(labelTo);
      const passing = lines(software, "line.waterfall-connector").filter(([x]) => Math.abs(x - to(products)) < 0.01);
      expect(passing.length).toBe(2);
      expect(passing.some(crossesMiddle)).toBe(false);
      expect(passing[0][1]).toBeLessThan(0);
      expect(passing[0][2]).toBeLessThanOrEqual(glyphs[0]);
      expect(passing[1][1]).toBeGreaterThanOrEqual(glyphs[1]);
      expect(passing[1][2]).toBeGreaterThanOrEqual(HEIGHT);
    });
  });

  describe("REST row of an opt table", () => {
    it("walks a REST row of only '-' rows to the left, so the walk ends at the sum", async () => {
      const page = await renderTable({ tableName: "varianceWalkRest", limit: 2 });
      const [sales, costA, rest, total] = ["Sales", "CostA", "REST", "Summe"].map((name) => svgOf(rowOf(page, name)));

      // Sales [0,10], CostA [10,7], REST [7,4], sum [0,4]
      const unit = (to(sales) - from(sales)) / 10;
      expect(to(rest)).toBeCloseTo(from(costA), 3);
      expect(from(rest)).toBeCloseTo(from(sales) + 4 * unit, 3);
      expect(to(total)).toBeCloseTo(from(rest), 3);
      expect(connectors(total).length).toBe(1);
      expect(label(rest).textContent).toMatch(/^\+3/);
    });

    it("walks a REST row of '+' and '-' rows by its signed sum", async () => {
      const page = await renderTable({ tableName: "varianceWalkMixedRest", limit: 2 });
      const [sales, costA, rest, total] = ["Sales", "CostA", "REST", "Summe"].map((name) => svgOf(rowOf(page, name)));

      // Sales [0,10], CostA [10,7], REST -2 -1 +4 = [7,8], sum [0,8]
      const unit = (to(sales) - from(sales)) / 10;
      expect(from(rest)).toBeCloseTo(from(costA), 3);
      expect(to(rest)).toBeCloseTo(from(sales) + 8 * unit, 3);
      expect(to(total)).toBeCloseTo(to(rest), 3);
      expect(connectors(total).length).toBe(1);
    });
  });

  it("prints the zero of a column without any variance", async () => {
    const cells = async (varianceWaterfall: boolean) =>
      bodyRows(await renderTable({ tableName: "varianceWalkZero", varianceWaterfall })).map((row) =>
        row.querySelector("td:last-child").textContent.trim(),
      );

    expect(await cells(false)).toEqual(["-", "-", "0.0"]);
    expect(await cells(true)).toEqual(["0.0", "0.0", "0.0"]);
  });

  describe("groups", () => {
    const renderGroups = (runningSum: boolean) =>
      renderTable({
        tableName: "varianceWalkGroups",
        type: TableType.OPTNOTOTAL,
        grouped: true,
        showGroupTitle: false,
        runningSum,
      });
    const groupSvgs = (page: SpecPage) => bodyRows(page).map((row) => svgOf(row));

    it("starts every group at the axis", async () => {
      // Alpha [0,4], sum [0,4], Beta [0,-3], sum [0,-3]
      const [alpha, sumA, beta, sumB] = groupSvgs(await renderGroups(false));

      expect(to(beta)).toBeCloseTo(axisX(beta), 3);
      expect(from(sumB)).toBeCloseTo(from(beta), 3);
      expect(from(sumA)).toBeCloseTo(from(alpha), 3);
      // no line from the sum row of the first group to the second group
      expect(connectors(sumA).length).toBe(1);
      expect(connectors(beta).length).toBe(1);
    });

    it("starts every group of a list table at the axis, also with runningSum", async () => {
      const renderList = (runningSum: boolean) =>
        renderTable({
          tableName: "varianceWalkGroups",
          type: TableType.LIST,
          grouped: true,
          showGroupTitle: true,
          runningSum,
        });
      const bars = async (runningSum: boolean) => {
        const page = await renderList(runningSum);
        return ["Alpha", "Beta"].map((name) => svgOf(rowOf(page, name))).map((svg) => [from(svg), to(svg), axisX(svg)]);
      };
      const off = await bars(false);

      // the walk of a list table has no sum row to go on from
      expect(await bars(true)).toEqual(off);
      expect(off[1][1]).toBeCloseTo(off[1][2], 3);
    });

    it("walks on from the sum row with runningSum and joins it over the gap", async () => {
      // Alpha [0,4], result [0,4], Beta [4,1], result [0,1]
      const [alpha, sumA, beta, sumB] = groupSvgs(await renderGroups(true));

      expect(to(beta)).toBeCloseTo(to(alpha), 3);
      expect(from(sumB)).toBeCloseTo(from(alpha), 3);
      expect(to(sumB)).toBeCloseTo(from(beta), 3);
      const down = connectors(sumA)[1];
      expect(down[0]).toBeCloseTo(to(sumA), 3);
      // through the padding below the sum row
      expect(down[2]).toBeGreaterThan(HEIGHT + 5);
      expect(connectors(beta)[0][0]).toBeCloseTo(to(sumA), 3);
    });
  });

  describe("thereof", () => {
    const thereof = [
      { rowGroup: "", category: "Beta", subCategory: "B1", partOf: "" },
      { rowGroup: "", category: "Beta", subCategory: "B2", partOf: "" },
    ];
    // a child row prints "davon B1" below its parent and "B1" above it
    const svgs = (page: SpecPage): Element[] =>
      ["Alpha", "Beta", "B1", "B2"].map((name) =>
        svgOf(
          bodyRows(page).find((row) =>
            Array.from(row.querySelectorAll("td")).some((td) => td.textContent.trim().split(" ").pop() === name),
          ),
        ),
      );
    const passes = (svg: Element, at: number): boolean =>
      connectors(svg).some(([x, y1, y2]) => Math.abs(x - at) < 0.01 && y1 < 0 && y2 >= HEIGHT);

    it("walks the children from the parent start by their own sign, without dashed guides", async () => {
      const page = await renderTable({ tableName: "varianceWalkThereof", thereof });
      const [alpha, beta, b1, b2] = svgs(page);

      // Alpha [0,4], Beta [4,1], B2 [4,6], B1 [6,1]
      const unit = (to(alpha) - from(alpha)) / 4;
      expect(from(b2)).toBeCloseTo(to(alpha), 3);
      expect(to(b2)).toBeCloseTo(to(alpha) + 2 * unit, 3);
      expect(to(b1)).toBeCloseTo(to(b2), 3);
      expect(from(b1)).toBeCloseTo(from(beta), 3);
      expect(label(b1).textContent).toMatch(/^\+5/);
      expect(label(b2).textContent).toMatch(/^-2/);
      expect(page.root.shadowRoot.querySelector("svg > line[stroke-dasharray]")).toBeNull();
      // the line from the parent end to the next row passes beside the children
      expect(passes(b1, from(beta))).toBe(true);
      expect(passes(b2, from(beta))).toBe(true);
    });

    it("keeps the geometry with the children printed above the parent", async () => {
      const below = svgs(await renderTable({ tableName: "varianceWalkThereof", thereof }));
      const above = svgs(
        await renderTable({ tableName: "varianceWalkThereof", thereof, thereofPosition: ThereofPosition.ABOVE }),
      );

      below.forEach((svg, index) => {
        expect(from(above[index])).toBeCloseTo(from(svg), 3);
        expect(to(above[index])).toBeCloseTo(to(svg), 3);
      });
      // the line from Alpha to the parent passes beside both children
      const [alpha, , b1, b2] = above;
      expect(passes(b1, to(alpha))).toBe(true);
      expect(passes(b2, to(alpha))).toBe(true);
    });

    it("prints the number of a partof row", async () => {
      const page = await renderTable({
        partof: [{ rowGroup: "", category: "Alpha", subCategory: "", partOf: "SUM_TOTAL" }],
      });
      const partRow = bodyRows(page).find((row) => classOf(row).includes("partof"));

      expect(partRow).toBeDefined();
      expect(svgOf(partRow)).toBeUndefined();
      expect(svgOf(rowOf(page, "Alpha"))).toBeDefined();
    });
  });
});
