// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
// mock-doc cannot measure text: every character is 6 px wide here.
jest.mock("calculate-size", () => ({
  __esModule: true,
  default: (text: string) => ({ width: text.length * 6, height: 12 }),
}));

import { Svg } from "@svgdotjs/svg.js";
import { StructureChart } from "./StructureChart";
import { FakeGroup, fakeGroup } from "../../../utils/testing/fakeGroup";
import { ElementPositions } from "./helper";
import { StackBy, StackMode, StackOrder } from "../../../utils/constants";
import { buildStructureChart, structureRow } from "../../../utils/testing/structureChart";
import { validateStackConfig } from "../../../utils/validate";

interface Row {
  category: string;
  sum?: string;
  gapAfter?: boolean;
  scenario1: { value: number; scenario: string };
  scenario2: { value: number; scenario: string };
  stackSegments?: { label: string; value: number }[];
}

interface ChartInternals {
  dataModel: Row[];
  position: ElementPositions;
  stackSides: { positive: number };
  isTextSum(row: Row): boolean;
  sumColumns(): { x: number[]; totalX: number; width: number } | null;
}

const internals = (chart: StructureChart): ChartInternals => chart as unknown as ChartInternals;

/** The value of a scenario of a row: the chart orders the slots by its own rules. */
const valueOf = (row: Row, scenario: string): number =>
  [row.scenario1, row.scenario2].find((point) => point.scenario === scenario)!.value;

const grouped = (category: string, index: number, group: string | null, groupIndex: number | null, ac1: number) => ({
  ...structureRow(category, index, { ac1, ac2: ac1 * 2 }),
  rowGroup: group,
  rowGroupIndex: groupIndex,
});

// the rows come mixed and are sorted by name: the chart keeps the rows of a group together
const ROWS = [
  grouped("Brazil", 1, null, null, 5),
  grouped("Spain", 2, "Europe", 1, 3),
  grouped("USA", 3, "Americas", 2, 7),
  grouped("France", 4, "Europe", 1, 4),
];

const chartOf = (config: Record<string, unknown>, rows: Record<string, unknown>[] = ROWS): StructureChart =>
  buildStructureChart(rows, { scenarios: ["ac1", "ac2"], pixelPerUnit: 10, ...config });

const stack = (extra: Record<string, unknown> = {}) => ({
  by: StackBy.SCENARIOS,
  mode: StackMode.ABSOLUTE,
  order: StackOrder.DATASET,
  ...extra,
});

describe("structure chart sum rows", () => {
  it("adds no row without sums", () => {
    expect(internals(chartOf({})).dataModel.map((row) => row.category)).toEqual(["Brazil", "France", "Spain", "USA"]);
  });

  it("adds a row below each rowGroup, in the order of the groups, and the row without a group last", () => {
    const rows = internals(chartOf({ sums: "groups" })).dataModel;

    expect(rows.map((row) => row.category)).toEqual(["France", "Spain", "Europe", "USA", "Americas", "Brazil"]);
    expect(rows[2]).toMatchObject({ sum: "group", gapAfter: true });
    expect(valueOf(rows[2], "ac1")).toBe(7);
    expect(valueOf(rows[2], "ac2")).toBe(14);
  });

  it("adds one row over all rows with the sum title", () => {
    const rows = internals(chartOf({ sums: "total", sumTitle: "World" })).dataModel;

    expect(rows.map((row) => row.category)).toEqual(["Brazil", "France", "Spain", "USA", "World"]);
    expect(rows[4].sum).toBe("total");
    expect(valueOf(rows[4], "ac1")).toBe(19);
  });

  it("names the total SUM_TOTAL without a title, and adds both kinds with all", () => {
    const rows = internals(chartOf({ sums: "all" })).dataModel;
    expect(rows.map((row) => row.category)).toEqual([
      "France",
      "Spain",
      "Europe",
      "USA",
      "Americas",
      "Brazil",
      "SUM_TOTAL",
    ]);
  });

  it("does not count a sum row for the scale", () => {
    const plain = chartOf({ scenarios: ["ac1"] });
    const withSum = chartOf({ scenarios: ["ac1"], sums: "total" });
    expect(withSum.getUnitBarExtent()).toBe(plain.getUnitBarExtent());

    const stacked = chartOf({ stackConfig: stack(), sums: "total" });
    // the longest stack is USA: 7 + 14
    expect(internals(stacked).stackSides.positive).toBe(21);
  });

  it("prints the sum row of a stack as numbers in one column per series, and of a 100 % stack as a bar", () => {
    const absolute = internals(chartOf({ stackConfig: stack(), sums: "total" }));
    expect(absolute.isTextSum(absolute.dataModel[4])).toBe(true);
    const columns = absolute.sumColumns()!;
    expect(columns.x).toHaveLength(2);
    expect(columns.x[1]).toBeGreaterThan(columns.x[0]);
    expect(columns.totalX).toBeGreaterThan(columns.x[1]);

    const relative = internals(chartOf({ stackConfig: stack({ mode: StackMode.RELATIVE }), sums: "total" }));
    expect(relative.isTextSum(relative.dataModel[4])).toBe(false);
    expect(relative.sumColumns()).toBeNull();
  });

  it("leaves half a row of room below a group", () => {
    const position = internals(chartOf({ sums: "groups" })).position;
    const pitch = position.spacings.categoryWidth;
    const y = (index: number): number => position.getBarCenterPositionY(index);

    expect(y(1) - y(0)).toBeCloseTo(pitch);
    // row 3 follows the sum row of the first group
    expect(y(3) - y(2)).toBeCloseTo(1.5 * pitch);
  });
});

describe("structure chart rows by total", () => {
  const ROWS_BY_TOTAL = [structureRow("A", 1, { ac1: 30 }), structureRow("B", 2, { ac1: 20 })];

  it("makes a bar as thick as the total of its row is large, with the same height over all", () => {
    const chart = internals(chartOf({ scenarios: ["ac1"], stackConfig: stack({ thickness: "total" }) }, ROWS_BY_TOTAL));
    const position = chart.position;
    const bar = position.spacings.barWidth;

    expect(position.getBarWidthAt(0)).toBeCloseTo(1.2 * bar);
    expect(position.getBarWidthAt(1)).toBeCloseTo(0.8 * bar);
    // the two rows together are as high as two equal rows
    expect(position.getBarCenterPositionY(1) - position.getBarCenterPositionY(0)).toBeCloseTo(
      position.spacings.categoryWidth,
    );
  });

  it("keeps a sum row at the height of one row", () => {
    const chart = internals(
      chartOf({ scenarios: ["ac1"], stackConfig: stack({ thickness: "total" }), sums: "total" }, ROWS_BY_TOTAL),
    );
    expect(chart.position.getBarWidthAt(2)).toBeCloseTo(chart.position.spacings.barWidth);
  });
});

describe("structure chart stack by dimensions", () => {
  const cell = (category: string, index: number, series: string, seriesIndex: number | undefined, ac1: number) => ({
    ...structureRow(category, index, { ac1 }),
    subCategory: series,
    subCategoryIndex: seriesIndex,
  });

  const segments = (rows: Record<string, unknown>[]): { label: string; value: number }[][] =>
    internals(chartOf({ scenarios: ["ac1"], stackConfig: stack({ by: StackBy.DIMENSIONS }) }, rows)).dataModel.map(
      (row) => row.stackSegments!.map(({ label, value }) => ({ label, value })),
    );

  it("orders the series by the index column and gives every row every series", () => {
    const result = segments([
      cell("A", 1, "Wholesale", 3, 1),
      cell("A", 1, "Direct", 1, 2),
      cell("A", 1, "Retail", 2, 3),
      // B has no Direct
      cell("B", 2, "Retail", 2, 4),
      cell("B", 2, "Wholesale", 3, 5),
    ]);

    expect(result[0]).toEqual([
      { label: "Direct", value: 2 },
      { label: "Retail", value: 3 },
      { label: "Wholesale", value: 1 },
    ]);
    expect(result[1]).toEqual([
      { label: "Direct", value: NaN },
      { label: "Retail", value: 4 },
      { label: "Wholesale", value: 5 },
    ]);
  });

  it("keeps the order of the rows without an index column", () => {
    const result = segments([
      cell("A", 1, "Wholesale", undefined, 1),
      cell("A", 1, "Direct", undefined, 2),
      cell("B", 2, "Direct", undefined, 4),
    ]);

    expect(result[0].map((segment) => segment.label)).toEqual(["Wholesale", "Direct"]);
    expect(result[1].map((segment) => segment.label)).toEqual(["Wholesale", "Direct"]);
  });

  it("sums the series of the rows for a sum row", () => {
    const chart = internals(
      chartOf({ scenarios: ["ac1"], stackConfig: stack({ by: StackBy.DIMENSIONS }), sums: "total" }, [
        cell("A", 1, "Direct", 1, 2),
        cell("A", 1, "Retail", 2, 3),
        cell("B", 2, "Retail", 2, 4),
      ]),
    );
    expect(chart.dataModel[2].stackSegments!.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Direct", value: 2 },
      { label: "Retail", value: 7 },
    ]);
  });
});

describe("stack keys of a structure chart", () => {
  it("takes the keys of a 100 % stack with values", () => {
    expect(
      validateStackConfig(
        '{"by":"scenarios","mode":"relative","labels":"value","thickness":"total","percentMark":true,"totalTitle":"All"}',
      ),
    ).toEqual([]);
  });

  it("reports a value it does not know", () => {
    expect(validateStackConfig('{"by":"scenarios","labels":"x","thickness":"y","totalTitle":1}')).toHaveLength(3);
  });
});

describe("findings of the review", () => {
  it("gives the REST row of a stack by dimensions the series of the rows it stands for", () => {
    const cell = (category: string, index: number, series: string, ac1: number) => ({
      ...structureRow(category, index, { ac1 }),
      subCategory: series,
      subCategoryIndex: series === "x" ? 1 : 2,
    });
    const chart = internals(
      chartOf(
        {
          scenarios: ["ac1"],
          limit: 2,
          sums: "total",
          sortOrder: { hierarchy: ["categoryIndex"], direction: "asc" },
          stackConfig: stack({ by: StackBy.DIMENSIONS }),
        },
        [
          cell("A", 1, "x", 10),
          cell("A", 1, "y", 20),
          cell("B", 2, "x", 5),
          cell("C", 3, "x", 100),
          cell("D", 4, "y", 200),
        ],
      ),
    );
    const rows = chart.dataModel;
    expect(rows.map((row) => row.category)).toEqual(["A", "B", "REST", "SUM_TOTAL"]);
    expect(rows[2].stackSegments!.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "x", value: 100 },
      { label: "y", value: 200 },
    ]);
    // the sum row adds up what the bars show
    expect(rows[3].stackSegments!.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "x", value: 115 },
      { label: "y", value: 220 },
    ]);
  });

  it("keeps a row by total at least one line of text high, with the same height over all", () => {
    const chart = internals(
      chartOf({ scenarios: ["ac1"], stackConfig: stack({ thickness: "total" }) }, [
        structureRow("A", 1, { ac1: 1900 }),
        structureRow("B", 2, { ac1: 30 }),
        structureRow("C", 3, { ac1: 11 }),
      ]),
    );
    const position = chart.position;
    const line = position.fontSize;
    const pitch = position.spacings.categoryWidth;
    const y = (index: number): number => position.getBarCenterPositionY(index);

    expect(y(2) - y(1)).toBeCloseTo(line);
    // three rows: from the top of the first to the bottom of the last
    const height = y(2) + line / 2 - (y(0) - (y(1) - line / 2 - y(0)));
    expect(height).toBeCloseTo(3 * pitch);
  });

  it("leaves room for the name of the scenario between the last bar and a sum row", () => {
    const rows = [structureRow("A", 1, { ac1: 10 }), structureRow("B", 2, { ac1: 20 })];
    const position = internals(chartOf({ scenarios: ["ac1"], sums: "total" }, rows)).position;
    const pitch = position.spacings.categoryWidth;

    expect(position.getBarCenterPositionY(1) - position.getBarCenterPositionY(0)).toBeCloseTo(pitch);
    expect(position.getBarCenterPositionY(2) - position.getBarCenterPositionY(1)).toBeCloseTo(2 * pitch);

    // no room with the name above the first bar, and none in a stack, which has its names there
    const top = internals(chartOf({ scenarios: ["ac1"], sums: "total", scenarioLabelTop: true }, rows)).position;
    expect(top.getBarCenterPositionY(2) - top.getBarCenterPositionY(1)).toBeCloseTo(pitch);
  });

  it("draws the variance of a sum row as a bar, so it counts for the scale of the variance chart", () => {
    const rows = [structureRow("A", 1, { ac1: 12, pp1: 10 }), structureRow("B", 2, { ac1: 14, pp1: 10 })];
    const config = { scenarios: ["ac1", "pp1"], variances: ["dac1_pp1_pos"] };

    // the variances are 2 and 4, the one of the sum row is 6
    expect(chartOf(config, rows).getUnitBarExtent()).toBe(4);
    expect(chartOf({ ...config, sums: "total" }, rows).getUnitBarExtent()).toBe(6);
    // the base chart next to it keeps its scale
    const base = { scenarios: ["ac1", "pp1"] };
    expect(chartOf({ ...base, sums: "total" }, rows).getUnitBarExtent()).toBe(chartOf(base, rows).getUnitBarExtent());
  });

  it("prints every scenario of the sum row of a chart with plain bars, in the order of the prop", () => {
    const rows = [structureRow("A", 1, { ac1: 12, pl1: 10 }), structureRow("B", 2, { ac1: 14, pl1: 20 })];
    const chart = chartOf({ scenarios: ["ac1", "pl1"], sums: "total" }, rows) as unknown as {
      dataModel: Row[];
      sumPoints(row: Row): { scenario: string; value: number }[];
      sumValuesWidth(row: Row): number;
    };
    const sum = chart.dataModel[2];
    expect(chart.sumPoints(sum).map(({ scenario, value }) => ({ scenario, value }))).toEqual([
      { scenario: "ac1", value: 26 },
      { scenario: "pl1", value: 30 },
    ]);

    const one = chartOf({ scenarios: ["ac1"], sums: "total" }, rows) as unknown as typeof chart;
    // two numbers with their squares need more room than one plain number
    expect(chart.sumValuesWidth(sum)).toBeGreaterThan(one.sumValuesWidth(one.dataModel[2]) * 2);
  });

  it("makes room for a reference line right of the longest bar", () => {
    const rows = [structureRow("A", 1, { ac1: 10 }), structureRow("B", 2, { ac1: 20 })];
    const plain = chartOf({ scenarios: ["ac1"], pixelPerUnit: 1 }, rows);
    const withLine = chartOf({ scenarios: ["ac1"], pixelPerUnit: 1, referenceLine: { value: 500 } }, rows);

    expect(withLine.getUnitBarExtent()).toBe(500);
    expect(withLine.getAllocatedCanvasWidth()).toBeGreaterThan(plain.getAllocatedCanvasWidth() + 400);
  });
});

describe("sum rows next to short and negative bars", () => {
  interface Drawing {
    dataModel: unknown[];
    position: ElementPositions;
    drawScenarios(dataModel: unknown[], svgContainer: Svg): void;
    drawAxisAndLabels(dataModel: unknown[], svgContainer: Svg, stacked?: boolean): void;
  }

  /** Every group below `root`, at any depth. */
  const all = (root: FakeGroup): FakeGroup[] => root.groups.flatMap((group) => [group, ...all(group)]);

  /** Where the label with this text starts, and how it is anchored. */
  const label = (root: FakeGroup, text: string): { x: number; anchor: string } => {
    const group = all(root).find((entry) => entry.calls.some(([name, args]) => name === "text" && args[0] === text));
    if (!group) throw new Error(`no label "${text}"`);
    const move = group.calls.find(([name]) => name === "move")![1];
    const anchors = group.calls.flatMap(([name, args]) =>
      name === "font" && (args[0] as { anchor?: string }).anchor ? [(args[0] as { anchor: string }).anchor] : [],
    );
    return { x: move[0] as number, anchor: anchors[anchors.length - 1] };
  };

  const draw = (chart: StructureChart, method: "drawScenarios" | "drawAxisAndLabels"): FakeGroup => {
    const container = fakeGroup();
    const drawing = chart as unknown as Drawing;
    drawing[method](drawing.dataModel, container.node as Svg);
    return container;
  };

  it("puts the name of the scenario beside the axis when a sum row follows a short last bar", () => {
    const rows = [structureRow("A", 1, { ac1: 100 }), structureRow("B", 2, { ac1: 1 })];
    const chart = chartOf({ scenarios: ["ac1"], pixelPerUnit: 1, sums: "total" }, rows);
    const position = (chart as unknown as Drawing).position;

    expect(position.isNameBelowBar()).toBe(true);
    // the name starts right of the axis line, which runs on to the sum row
    expect(label(draw(chart, "drawScenarios"), "AC")).toEqual({
      x: position.getBarPositionX() + position.spacings.labelToAxis,
      anchor: "start",
    });
  });

  it("keeps the name centred below the last bar without a sum row", () => {
    const rows = [structureRow("A", 1, { ac1: 100 }), structureRow("B", 2, { ac1: 40 })];
    const chart = chartOf({ scenarios: ["ac1"], pixelPerUnit: 1 }, rows);
    const position = (chart as unknown as Drawing).position;

    expect(position.isNameBelowBar()).toBe(false);
    expect(label(draw(chart, "drawScenarios"), "AC")).toEqual({ x: position.getBarPositionX() + 20, anchor: "middle" });
  });

  it("keeps the title of a sum row with several numbers left of the axis, also for a negative sum", () => {
    const rows = [structureRow("A", 1, { ac1: -30, pp1: 10 }), structureRow("B", 2, { ac1: 10, pp1: 20 })];
    const chart = chartOf({ scenarios: ["ac1", "pp1"], sums: "total", sumTitle: "World" }, rows);
    const position = (chart as unknown as Drawing).position;

    expect(label(draw(chart, "drawAxisAndLabels"), "World")).toEqual({
      x: position.getCategoryPositionX(true),
      anchor: "end",
    });
    // a negative number of the sum row starts behind its square and does not run back over it
    const numbers = draw(chart, "drawScenarios");
    expect(label(numbers, "-20,0").anchor).toBe("start");
    expect(label(numbers, "30,0").anchor).toBe("start");
    expect(label(numbers, "30,0").x).toBeGreaterThan(label(numbers, "-20,0").x);
  });

  it("puts the title of a negative sum with one number right of the axis, like the label of a negative bar", () => {
    const rows = [structureRow("A", 1, { ac1: -30 }), structureRow("B", 2, { ac1: 10 })];
    const chart = chartOf({ scenarios: ["ac1"], sums: "total", sumTitle: "World" }, rows);
    const position = (chart as unknown as Drawing).position;

    expect(label(draw(chart, "drawAxisAndLabels"), "World")).toEqual({
      x: position.getCategoryPositionX(false),
      anchor: "start",
    });
    expect(label(draw(chart, "drawScenarios"), "-20,0").anchor).toBe("end");
  });

  it("leaves no room for a scenario name that no chart draws", () => {
    const rows = [structureRow("A", 1, { ac1: 12, pp1: 10 }), structureRow("B", 2, { ac1: 14, pp1: 10 })];
    const config = { scenarios: ["ac1", "pp1"], variances: ["dac1_pp1_pos"], sums: "total" };
    const pitch = (chart: StructureChart): number => {
      const position = (chart as unknown as Drawing).position;
      return (position.getBarCenterPositionY(2) - position.getBarCenterPositionY(1)) / position.spacings.categoryWidth;
    };

    // next to a base chart the variance chart leaves the same room as the base chart
    expect(pitch(chartOf(config, rows))).toBeCloseTo(2);
    // a component that shows variances only has no name to leave room for
    expect(pitch(chartOf({ ...config, hideScenarioName: true }, rows))).toBeCloseTo(1);
  });
});

describe("room behind a 100 % stack", () => {
  const roomOf = (extra: Record<string, unknown>): number => {
    const chart = chartOf({
      pixelPerUnit: 1000,
      stackConfig: stack({ mode: StackMode.RELATIVE, ...extra }),
    }) as unknown as {
      calculateRightSideWidth(variance?: unknown): number;
      stackSides: { positive: number };
      pixelPerUnit: number;
    };
    return chart.calculateRightSideWidth() - chart.stackSides.positive * chart.pixelPerUnit;
  };

  it("keeps room for the total only when the total is printed", () => {
    // every character is 6 px wide here: half of "100%" is 12 px
    expect(roomOf({})).toBeCloseTo(0, 5);
    expect(roomOf({ percentMark: true })).toBeCloseTo(12, 5);
    expect(roomOf({ labels: "value" })).toBeGreaterThan(12);
  });
});

describe("room for the stack headers", () => {
  it("covers a header that is wider than its segment at the end of the bar", () => {
    const chart = chartOf({ pixelPerUnit: 20, stackConfig: stack({ mode: StackMode.RELATIVE }) }) as unknown as {
      calculateRightSideWidth(): number;
      stackHeaderExtent(): number;
      stackSides: { positive: number };
      pixelPerUnit: number;
    };
    // a full bar is 20 px here, a header of three characters is 18 px: the last one ends behind the bar
    expect(chart.stackHeaderExtent()).toBeGreaterThan(chart.stackSides.positive * chart.pixelPerUnit);
    expect(chart.calculateRightSideWidth()).toBeGreaterThanOrEqual(chart.stackHeaderExtent());
  });
});
