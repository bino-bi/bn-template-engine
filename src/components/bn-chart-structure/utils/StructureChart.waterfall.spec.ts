// mock-doc cannot measure text
jest.mock("calculate-size", () => ({ __esModule: true, default: () => ({ width: 10, height: 10 }) }));

import { StructureChart } from "./StructureChart";
import { DataPoint } from "./model";
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

// previous year 1000, actual 900: the variances are +20, -150, +30
const ROWS = [
  { operation: "+", category: "A", categoryIndex: 1, ac1: 120, pp1: 100 },
  { operation: "+", category: "B", categoryIndex: 2, ac1: 450, pp1: 600 },
  { operation: "+", category: "REST", categoryIndex: 3, ac1: 330, pp1: 300 },
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
    scenarios: ["ac1", "pp1"],
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

interface Step {
  index: number;
  from: number;
  to: number;
}

interface ChartInternals {
  dataModel: { category: string; sum?: string; scenario1: DataPoint; scenario2: DataPoint }[];
  variancesDataModel: { scenario1: DataPoint; sum?: string }[];
  bridge: { reference: DataPoint; total: DataPoint; steps: Step[]; variance: DataPoint | null } | null;
  highestDataPointValue: DataPoint;
  highestVarianceDataPointValue: DataPoint;
  smallestVarianceDataPointValue: DataPoint;
  walkSteps(model: unknown[], start?: number): Step[];
  isWalkTier(): boolean;
  rowLayout(): { start: number[]; total: number } | null;
}

const internals = (chart: StructureChart): ChartInternals => chart as unknown as ChartInternals;
const categories = (chart: StructureChart): string[] => internals(chart).dataModel.map((row) => row.category);
const order = (hierarchy: string[], direction: string) => ({ sortOrder: { hierarchy, direction } });
const plain = (steps: Step[]) => steps.map(({ index, from, to }) => ({ index, from, to }));

const BRIDGE = { varianceWaterfall: true, bridgeVariances: ["dac1_pp1_pos"], sums: "total", sumTitle: "AC" };

describe("structure chart order by a variance", () => {
  const MORE = [...ROWS, { operation: "+", category: "C", categoryIndex: 4, ac1: 50, pp1: 40 }];

  it("sorts by an absolute variance and keeps REST last", () => {
    // +20, -150, +10, and REST +30
    expect(categories(buildChart(order(["dac1_pp1"], "desc"), MORE))).toEqual(["A", "C", "B", "REST"]);
    expect(categories(buildChart(order(["dac1_pp1"], "asc"), MORE))).toEqual(["B", "C", "A", "REST"]);
  });

  it("sorts by a relative variance", () => {
    // +20 %, -25 %, +25 %
    expect(categories(buildChart(order(["drac1_pp1"], "desc"), MORE))).toEqual(["C", "A", "B", "REST"]);
  });

  it("takes the sentiment of a variance name", () => {
    expect(categories(buildChart(order(["dac1_pp1_pos"], "desc"), MORE))).toEqual(["A", "C", "B", "REST"]);
  });

  it("reads the scenarios of the variance when the chart does not draw them", () => {
    const chart = buildChart({ scenarios: ["ac1"], ...order(["dac1_pp1"], "desc") }, MORE);
    expect(categories(chart)).toEqual(["A", "C", "B", "REST"]);
  });

  it("keeps REST last under an order by a scenario or a name", () => {
    expect(categories(buildChart(order(["ac1"], "desc"), MORE))).toEqual(["B", "A", "C", "REST"]);
    const named = [{ operation: "+", category: "Z", categoryIndex: 0, ac1: 1, pp1: 1 }, ...ROWS];
    expect(categories(buildChart(order(["category"], "asc"), named))).toEqual(["A", "B", "Z", "REST"]);
  });
});

describe("structure chart variance walk", () => {
  it("starts each step where the step before ended", () => {
    const chart = buildChart({ variances: ["dac1_pp1_pos"], varianceWaterfall: true });
    expect(internals(chart).isWalkTier()).toBe(true);
    expect(plain(internals(chart).walkSteps(internals(chart).variancesDataModel))).toEqual([
      { index: 0, from: 0, to: 20 },
      { index: 1, from: 20, to: -130 },
      { index: 2, from: -130, to: -100 },
    ]);
    expect(internals(chart).highestVarianceDataPointValue.value).toBe(20);
    expect(internals(chart).smallestVarianceDataPointValue.value).toBe(-130);
  });

  it("gives a sum row no step and its own bar", () => {
    const chart = buildChart({ variances: ["dac1_pp1_pos"], varianceWaterfall: true, sums: "total" });
    const steps = internals(chart).walkSteps(internals(chart).variancesDataModel);
    expect(steps.map((step) => step.index)).toEqual([0, 1, 2]);
    expect(internals(chart).smallestVarianceDataPointValue.value).toBe(-130);
    expect(chart.toString()).toContain('id="Walk"');
  });

  it("leaves relative variances and a chart without the attribute as they are", () => {
    expect(internals(buildChart({ variances: ["drac1_pp1_pos"], varianceWaterfall: true })).isWalkTier()).toBe(false);
    expect(internals(buildChart({ variances: ["dac1_pp1_pos"] })).isWalkTier()).toBe(false);
  });
});

describe("structure chart bridge", () => {
  it("runs from the reference total to the total of the series", () => {
    const chart = buildChart(BRIDGE);
    const bridge = internals(chart).bridge!;
    expect(bridge.reference.value).toBe(1000);
    expect(bridge.total.value).toBe(900);
    expect(plain(bridge.steps)).toEqual([
      { index: 0, from: 1000, to: 1020 },
      { index: 1, from: 1020, to: 870 },
      { index: 2, from: 870, to: 900 },
    ]);
    expect(bridge.variance?.value).toBe(-100);
    // the chart is as wide as the walk
    expect(internals(chart).highestDataPointValue.value).toBe(1020);
  });

  it("keeps room for the totals in every segment", () => {
    const layout = internals(buildChart(BRIDGE)).rowLayout()!;
    expect(layout.start[0]).toBeGreaterThan(1);
    expect(internals(buildChart({ ...BRIDGE, variances: ["drac1_pp1_pos"] })).rowLayout()).toEqual(layout);
    expect(internals(buildChart({ sums: "total", hideScenarioName: true })).rowLayout()).toBeNull();
  });

  it("hides the segment of its variance and keeps the others", () => {
    expect(buildChart({ ...BRIDGE, variances: ["dac1_pp1_pos"] }).isBridgeTier()).toBe(true);
    expect(buildChart({ ...BRIDGE, variances: ["drac1_pp1_pos"] }).isBridgeTier()).toBe(false);
    expect(buildChart(BRIDGE).isBridgeTier()).toBe(false);
  });

  it("draws the two total bars and the variance of the total", () => {
    const svg = buildChart(BRIDGE).toString();
    expect(svg).toContain('id="Bridge"');
    expect(svg).toContain('data-bn-value="1000"');
    expect(svg).toContain('data-bn-value="900"');
  });

  it.each([
    ["sum rows per group", { sums: "all" }, "sums is not total"],
    ["a walk that crosses the bars", { pixelPerUnit: 0.01 }, "the walk would cross the bars of the rows"],
  ])("falls back to the walk for %s", (_name, options, reason) => {
    const chart = buildChart({ ...BRIDGE, ...options });
    expect(internals(chart).bridge).toBeNull();
    expect(chart.getBridgeFallback()).toBe(reason);
  });

  it("falls back when a row has no reference", () => {
    const rows = [ROWS[0], { operation: "+", category: "B", categoryIndex: 2, ac1: 450 }, ROWS[2]];
    const chart = buildChart(BRIDGE, rows);
    expect(internals(chart).bridge).toBeNull();
    expect(chart.getBridgeFallback()).toBe("the reference total plus the variances is not the total of the series");
  });

  it("reports nothing without a total row or without the attribute", () => {
    expect(buildChart({ varianceWaterfall: true, bridgeVariances: ["dac1_pp1_pos"] }).getBridgeFallback()).toBeNull();
    expect(buildChart({ sums: "total" }).getBridgeFallback()).toBeNull();
  });
});

describe("structure chart sum row keys", () => {
  it("marks the points of a total row with row total", () => {
    const chart = buildChart({ sums: "total", sumTitle: "AC" });
    const total = internals(chart).dataModel.find((row) => row.sum === "total")!;
    expect(total.scenario1.key).toEqual({ category: "AC", scenario: "ac1", row: "total" });
    expect(internals(chart).dataModel[0].scenario1.key).toEqual({ category: "A", scenario: "ac1" });
  });

  it("marks the variance of a total row too", () => {
    const chart = buildChart({ sums: "total", sumTitle: "AC", variances: ["dac1_pp1_pos"] });
    const total = internals(chart).variancesDataModel.find((row) => row.sum === "total")!;
    expect(total.scenario1.key).toEqual({ category: "AC", scenario: "dac1_pp1_pos", row: "total" });
  });
});

describe("structure chart percent sign", () => {
  it("prints relative variances without the sign on request", () => {
    const withSign = buildChart({ variances: ["drac1_pp1_pos"], dataFormatDigits: { percent: 0, decimal: 0 } });
    expect(withSign.toString()).toContain("+20%");
    const without = buildChart({
      variances: ["drac1_pp1_pos"],
      dataFormatDigits: { percent: 0, decimal: 0, percentSign: false },
    });
    expect(without.toString()).not.toContain("+20%");
    expect(without.toString()).toContain(">+20<");
  });
});

describe("structure chart reference label", () => {
  const labels = (chart: StructureChart): number =>
    (chart.toString().match(/data-bn-scenario="pp1" data-bn-part="label"/g) ?? []).length;

  it("prints the value of a reference bar that is much longer than the bar in front", () => {
    const rows = [
      { operation: "+", category: "A", categoryIndex: 1, ac1: 100, pp1: 300 },
      { operation: "+", category: "B", categoryIndex: 2, ac1: 100, pp1: 105 },
      { operation: "+", category: "C", categoryIndex: 3, ac1: 100, pp1: 90 },
    ];
    expect(labels(buildChart({}, rows))).toBe(1);
  });
});
