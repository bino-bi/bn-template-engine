// mock-doc cannot measure text
jest.mock("calculate-size", () => ({ __esModule: true, default: () => ({ width: 10, height: 10 }) }));

import { StructureChart } from "./StructureChart";
import { StructureChartComponentConfigAdapter, StructureChartDataRowAdapter } from "./model";
import { StructureChartStylesAdapter } from "./model/styles/StructureChartStyle";
import { ScaleFactorsStructureChartAdapter } from "./model";
import { createScopedDb, buildFromExpr } from "../../../context/scopedDb";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { OrderAdapter } from "../../../utils/model/Order";
import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";

const TABLE = "states";

// mock-doc has no getBBox: a fixed box is enough, the tests read no measured size
beforeAll(() => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const proto = Object.getPrototypeOf(node) as { getBBox?: () => unknown };
  proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
});

// plan against actual: the variances are +20, -150, +30, -40, +5
const ROWS = [
  { operation: "+", category: "A", categoryIndex: 1, ac1: 120, pl1: 100 },
  { operation: "+", category: "B", categoryIndex: 2, ac1: 450, pl1: 600 },
  { operation: "+", category: "C", categoryIndex: 3, ac1: 330, pl1: 300 },
  { operation: "+", category: "D", categoryIndex: 4, ac1: 60, pl1: 100 },
  { operation: "+", category: "E", categoryIndex: 5, ac1: 105, pl1: 100 },
];

const buildChart = (options: Record<string, unknown>, rows: Record<string, unknown>[] = ROWS): StructureChart => {
  const db = createScopedDb().db;
  db.tables[TABLE] = { data: rows };

  const config = new StructureChartComponentConfigAdapter(
    new StructureChartDataRowAdapter(),
    new OrderAdapter(new StringAdapter(), true),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1", "pl1"],
    level: "category",
    sortOrder: { hierarchy: ["categoryIndex"], direction: "asc" },
    pixelPerUnit: 1,
    pixelPerPercentage: 100,
    ...options,
  });

  const styles = new StructureChartStylesAdapter(
    new ScaleFactorsStructureChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});

  return new StructureChart(new IBCSRuleSet(), db, TABLE, config, styles);
};

const count = (svg: string, name: string): number => (svg.match(new RegExp(`class="${name}"`, "g")) ?? []).length;
const lineEnds = (svg: string, name: string): { x1: number; x2: number }[] =>
  [...svg.matchAll(new RegExp(`<line[^>]*class="${name}"[^>]*>`, "g"))].map((match) => ({
    x1: Number(/x1="([^"]+)"/.exec(match[0])?.[1]),
    x2: Number(/x2="([^"]+)"/.exec(match[0])?.[1]),
  }));

describe("structure chart row lines", () => {
  it("draws a line after every n-th row, not after the last one", () => {
    expect(count(buildChart({ rowLines: 2 }).toString(), "row-line")).toBe(2);
    expect(count(buildChart({ rowLines: 5 }).toString(), "row-line")).toBe(0);
    expect(count(buildChart({}).toString(), "row-line")).toBe(0);
  });

  it("draws none where the line of a sum row stands", () => {
    // four rows and the total: the line after the fourth row is the line of the total
    const svg = buildChart({ rowLines: 2, sums: "total" }, ROWS.slice(0, 4)).toString();
    expect(count(svg, "row-line")).toBe(1);
    expect(count(svg, "sum-line")).toBe(1);
  });

  it("draws the same lines in a segment of a variance, over its whole width", () => {
    const chart = buildChart({ rowLines: 2, tiers: true, hideCategories: true, variances: ["dac1_pl1_pos"] });
    const svg = chart.toString();
    const ends = lineEnds(svg, "row-line");
    expect(ends).toHaveLength(2);
    // from the margin left of the segment to its right edge
    expect(ends[0].x1).toBeLessThan(0);
    expect(ends[0].x2).toBeCloseTo(chart.getAllocatedCanvasWidth());
    expect(svg).toContain('overflow="visible"');
  });
});

describe("structure chart line of a sum row", () => {
  it("ends behind the numbers in a chart with one segment", () => {
    const chart = buildChart({ sums: "total" });
    const [line] = lineEnds(chart.toString(), "sum-line");
    expect(line.x2).toBeLessThan(chart.getAllocatedCanvasWidth());
  });

  it("runs over the whole segment in a chart with several segments", () => {
    const chart = buildChart({ sums: "total", tiers: true });
    const [line] = lineEnds(chart.toString(), "sum-line");
    expect(line.x2).toBeCloseTo(chart.getAllocatedCanvasWidth());
    const variance = buildChart({ sums: "total", tiers: true, hideCategories: true, variances: ["drac1_pl1_pos"] });
    const [other] = lineEnds(variance.toString(), "sum-line");
    expect(other.x1).toBeLessThan(0);
    expect(other.x2).toBeCloseTo(variance.getAllocatedCanvasWidth());
  });
});

describe("structure chart mark of the order", () => {
  const order = (column: string) => ({ hierarchy: [column], direction: "desc" });
  const marks = (options: Record<string, unknown>): number =>
    count(buildChart({ orderMark: true, ...options }).toString(), "order-mark");

  it("marks the segment of the variance the rows are sorted by", () => {
    expect(marks({ sortOrder: order("dac1_pl1"), variances: ["dac1_pl1_pos"] })).toBe(1);
    expect(marks({ sortOrder: order("dac1_pl1"), variances: ["drac1_pl1_pos"] })).toBe(0);
    expect(marks({ sortOrder: order("drac1_pl1_neg"), variances: ["drac1_pl1_pos"] })).toBe(1);
    // the bars are not the column of the order
    expect(marks({ sortOrder: order("dac1_pl1") })).toBe(0);
  });

  it("marks the bars for an order by a scenario", () => {
    expect(marks({ sortOrder: order("ac1") })).toBe(1);
    expect(marks({ sortOrder: order("pl1") })).toBe(1);
    expect(marks({ sortOrder: order("ac1"), scenarioLabelTop: true })).toBe(1);
    expect(marks({ sortOrder: order("ac1"), variances: ["dac1_pl1_pos"] })).toBe(0);
    // a scenario the chart does not draw has no place for a mark
    expect(marks({ sortOrder: order("fc1") })).toBe(0);
  });

  it("draws none for an order by a dimension, and none without the switch", () => {
    expect(marks({})).toBe(0);
    expect(count(buildChart({ sortOrder: order("ac1") }).toString(), "order-mark")).toBe(0);
  });

  it("counts for the width of the segment", () => {
    const options = { sortOrder: order("dac1_pl1"), variances: ["dac1_pl1_pos"], hideCategories: true };
    const rows = ROWS.map((row) => ({ ...row, ac1: row.pl1 - 1 }));
    const plain = buildChart(options, rows).getAllocatedCanvasWidth();
    const marked = buildChart({ ...options, orderMark: true }, rows).getAllocatedCanvasWidth();
    expect(marked).toBeGreaterThan(plain);
  });
});

describe("structure chart name of the first scenario on top", () => {
  const header = (chart: StructureChart): number => {
    const match = /id="[^"]*SCENARIO_HEADER[^"]*"[\s\S]*?<text[^>]* x="([^"]+)"/.exec(chart.toString());
    return Number(match?.[1]);
  };

  it("stands at the end of the first bar when the row has a reference bar", () => {
    // ac 120, pl 100: right of the reference bar and of its name
    expect(header(buildChart({ scenarioLabelTop: true }))).toBeGreaterThan(100);
  });

  it("stands at the axis in a chart with one scenario", () => {
    const one = buildChart({ scenarioLabelTop: true, scenarios: ["ac1"] });
    const two = buildChart({ scenarioLabelTop: true });
    expect(header(one)).toBeLessThan(header(two) - 100);
  });
});

describe("structure chart value of a longer reference bar", () => {
  const labels = (chart: StructureChart): number =>
    (chart.toString().match(/id="[^"]*REFERENCE_\d+[^"]*"/g) ?? []).length;
  const rows = [
    { operation: "+", category: "A", categoryIndex: 1, ac1: 100, pl1: 300 },
    { operation: "+", category: "B", categoryIndex: 2, ac1: 100, pl1: 125 },
    { operation: "+", category: "C", categoryIndex: 3, ac1: 100, pl1: 105 },
    { operation: "+", category: "D", categoryIndex: 4, ac1: 2000, pl1: 1900 },
  ];

  it("is printed where the label of the front bar fits between the bar ends", () => {
    // labels are 10 wide in this test: 200 and 25 are room enough, 5 is not
    expect(labels(buildChart({}, rows))).toBe(2);
  });

  it("is printed in a chart with break marks for the rows that are not cut", () => {
    const chart = buildChart({}, rows);
    chart.setAvailableWidth(800);
    expect(chart.toString()).toContain("path");
    expect(labels(chart)).toBe(2);
  });

  it("is not printed for a reference bar that is cut", () => {
    const cut = [...rows.slice(1), { operation: "+", category: "A", categoryIndex: 1, ac1: 100, pl1: 1950 }];
    const chart = buildChart({}, cut);
    chart.setAvailableWidth(800);
    expect(labels(chart)).toBe(1);
  });
});
