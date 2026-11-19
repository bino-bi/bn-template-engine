// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
// mock-doc cannot measure text: every character is 6 px wide here.
jest.mock("calculate-size", () => ({
  __esModule: true,
  default: (text: string) => ({ width: text.length * 6, height: 12 }),
}));

import { StructureChart } from "./StructureChart";
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
  const ROWS_BY_TOTAL = [structureRow("A", 1, { ac1: 30 }), structureRow("B", 2, { ac1: 10 })];

  it("makes a bar as thick as the total of its row is large, with the same height over all", () => {
    const chart = internals(chartOf({ scenarios: ["ac1"], stackConfig: stack({ thickness: "total" }) }, ROWS_BY_TOTAL));
    const position = chart.position;
    const bar = position.spacings.barWidth;

    expect(position.getBarWidthAt(0)).toBeCloseTo(1.5 * bar);
    expect(position.getBarWidthAt(1)).toBeCloseTo(0.5 * bar);
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
