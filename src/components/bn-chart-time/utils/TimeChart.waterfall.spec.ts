// mock-doc cannot measure text
jest.mock("calculate-size", () => ({ __esModule: true, default: () => ({ width: 10, height: 10 }) }));

import { TimeChart } from "./TimeChart";
import { DataPoint } from "./model";
import { TimeChartComponentConfigAdapter } from "./model/TimeChartComponentConfig";
import { TimeChartDataRowAdapter } from "./model/TimeChartDataRow";
import { TimeChartStylesAdapter } from "./model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "./model/styles/ScaleFactorsTimeChart";
import { createScopedDb, buildFromExpr } from "../../../context/scopedDb";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";

const TABLE = "trend";

// mock-doc has no getBBox: a fixed box is enough, the tests read no measured size
beforeAll(() => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const proto = Object.getPrototypeOf(node) as { getBBox?: () => unknown };
  proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
});

// AC for two months, FC for two, a plan for every month: plan 51, AC plus FC 76
const ROWS = [
  { date: "2025-01-01", operation: "+", ac1: 15, pl1: 11 },
  { date: "2025-02-01", operation: "+", ac1: 13, pl1: 10 },
  { date: "2025-03-01", operation: "+", fc1: 26, pl1: 15 },
  { date: "2025-04-01", operation: "+", fc1: 22, pl1: 15 },
];

const buildChart = (
  options: Record<string, unknown>,
  rows: Record<string, unknown>[] = ROWS,
  tables: Record<string, Record<string, unknown>[]> = {},
): TimeChart => {
  const db = createScopedDb().db;
  db.tables[TABLE] = { data: rows };
  for (const [name, data] of Object.entries(tables)) {
    db.tables[name] = { data };
  }

  const config = new TimeChartComponentConfigAdapter(
    new TimeChartDataRowAdapter(),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1", "pl1", "fc1"],
    dateInterval: "month",
    scenarioSwitch: true,
    pixelPerUnit: 2,
    pixelPerPercentage: 10,
    ...options,
  });

  const styles = new TimeChartStylesAdapter(
    new ScaleFactorsTimeChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});

  return new TimeChart(new IBCSRuleSet(), db, TABLE, config, styles);
};

interface Step {
  index: number;
  from: number;
  to: number;
  run: number;
}

interface ChartInternals {
  bridge: { reference: { scenario: string; value: number }; total: number; steps: Step[] } | null;
  variancesDataModel: { scenario1: DataPoint }[];
  highestVarianceDataPointValue: DataPoint;
  smallestVarianceDataPointValue: DataPoint;
  walkSteps(model: unknown[], start?: number): Step[];
  dateLabelPlace(entry: unknown): { hookLocation: unknown };
  isWalkTier(): boolean;
  referenceColumnSlot(): string | null;
  leadRoom(): number;
}

const internals = (chart: TimeChart): ChartInternals => chart as unknown as ChartInternals;

const ABSOLUTE = ["dac1_pl1_pos", "dfc1_pl1_pos"];
const RELATIVE = ["drac1_pl1_pos", "drfc1_pl1_pos"];
const TOTALS = { by: "all", aggregation: "sum", pixelPerUnit: 0, label: "2025", width: 1, dataset: "" };
const BRIDGE = { varianceWaterfall: true, bridgeVariances: ABSOLUTE, totals: TOTALS };

describe("time chart variance walk", () => {
  it("starts each step where the step before ended", () => {
    const chart = buildChart({ variances: ABSOLUTE, varianceWaterfall: true });
    const steps = internals(chart).walkSteps(internals(chart).variancesDataModel);
    expect(steps.map(({ index, from, to }) => ({ index, from, to }))).toEqual([
      { index: 0, from: 0, to: 4 },
      { index: 1, from: 4, to: 7 },
      { index: 2, from: 7, to: 18 },
      { index: 3, from: 18, to: 25 },
    ]);
  });

  it("keeps the level in a period without a value", () => {
    const rows = [ROWS[0], { date: "2025-02-01", operation: "+", pl1: 10 }, ROWS[2]];
    const chart = buildChart({ variances: ABSOLUTE, varianceWaterfall: true }, rows);
    const steps = internals(chart).walkSteps(internals(chart).variancesDataModel);
    expect(steps.map(({ index, from, to }) => ({ index, from, to }))).toEqual([
      { index: 0, from: 0, to: 4 },
      { index: 2, from: 4, to: 15 },
    ]);
  });

  it("is as high as its levels", () => {
    const rows = [
      { date: "2025-01-01", operation: "+", ac1: 5, pl1: 10 },
      { date: "2025-02-01", operation: "+", ac1: 20, pl1: 10 },
      { date: "2025-03-01", operation: "+", ac1: 10, pl1: 8 },
    ];
    const chart = buildChart({ scenarios: ["ac1", "pl1"], variances: ["dac1_pl1_pos"], varianceWaterfall: true }, rows);
    expect(internals(chart).highestVarianceDataPointValue.value).toBe(7);
    expect(internals(chart).smallestVarianceDataPointValue.value).toBe(-5);
  });

  it("leaves relative variances and a chart without the attribute as they are", () => {
    expect(internals(buildChart({ variances: RELATIVE, varianceWaterfall: true })).isWalkTier()).toBe(false);
    expect(internals(buildChart({ variances: ABSOLUTE })).isWalkTier()).toBe(false);
    expect(internals(buildChart({ variances: ABSOLUTE, varianceWaterfall: true })).isWalkTier()).toBe(true);
  });

  it("starts again behind a total column on the axis", () => {
    const rows = [
      { date: "2025-01-01", operation: "+", ac1: 15, pl1: 11 },
      { date: "2025-03-01", operation: "+", ac1: 13, pl1: 10 },
      { date: "2025-04-01", operation: "+", ac1: 26, pl1: 15 },
      { date: "2025-06-01", operation: "+", ac1: 22, pl1: 15 },
    ];
    const chart = buildChart(
      {
        scenarios: ["ac1", "pl1"],
        variances: ["dac1_pl1_pos"],
        varianceWaterfall: true,
        totals: { ...TOTALS, by: "quarter", pixelPerUnit: 0.5 },
      },
      rows,
    );
    const steps = internals(chart).walkSteps(internals(chart).variancesDataModel);
    expect(steps.map(({ from, to, run }) => ({ from, to, run }))).toEqual([
      { from: 0, to: 4, run: 0 },
      { from: 4, to: 7, run: 0 },
      { from: 0, to: 11, run: 1 },
      { from: 11, to: 18, run: 1 },
    ]);
    // the row is as high as the highest level of a quarter, not as their sum
    expect(internals(chart).highestVarianceDataPointValue.value).toBe(18);
  });

  it("puts the date label opposite the column of a step", () => {
    const rows = [
      { date: "2025-01-01", operation: "+", ac1: 20, pl1: 10 },
      { date: "2025-02-01", operation: "+", ac1: 2, pl1: 10 },
      { date: "2025-03-01", operation: "+", ac1: 1, pl1: 10 },
    ];
    const chart = buildChart({ scenarios: ["ac1", "pl1"], variances: ["dac1_pl1_pos"], varianceWaterfall: true }, rows);
    const model = internals(chart).variancesDataModel;
    const flipped = model.map((entry) => internals(chart).dateLabelPlace(entry).hookLocation);
    // +10 from 0, -8 down to 2 (still above the axis), -9 down to -7 (crosses it)
    expect(flipped[0]).toBe(flipped[1]);
    expect(flipped[2]).not.toBe(flipped[0]);
  });

  it("draws the walk with its lines", () => {
    const svg = buildChart({ variances: ABSOLUTE, varianceWaterfall: true }).toString();
    expect(svg).toContain('id="Walk"');
    expect((svg.match(/<line/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("time chart bridge", () => {
  it("runs from the reference total to the total of the series", () => {
    const bridge = internals(buildChart(BRIDGE)).bridge!;
    expect(bridge.reference).toEqual({ scenario: "pl1", value: 51 });
    expect(bridge.total).toBe(76);
    expect(bridge.steps[0].from).toBe(51);
    expect(bridge.steps[bridge.steps.length - 1].to).toBe(76);
  });

  it("hides the row of its variances and keeps the others", () => {
    expect(buildChart({ ...BRIDGE, variances: ABSOLUTE }).isBridgeTier()).toBe(true);
    expect(buildChart({ ...BRIDGE, variances: RELATIVE }).isBridgeTier()).toBe(false);
    expect(buildChart(BRIDGE).isBridgeTier()).toBe(false);
  });

  it("keeps room for the reference total in every tier", () => {
    const base = internals(buildChart(BRIDGE)).leadRoom();
    expect(base).toBeGreaterThan(0);
    expect(internals(buildChart({ ...BRIDGE, variances: RELATIVE })).leadRoom()).toBe(base);
    expect(internals(buildChart({ totals: TOTALS })).leadRoom()).toBe(0);
  });

  it("adds no room to a synced left space", () => {
    expect(internals(buildChart({ ...BRIDGE, syncedLeft: true })).leadRoom()).toBe(0);
  });

  it("draws the reference total, the steps and the variance of the total", () => {
    const svg = buildChart(BRIDGE).toString();
    expect(svg).toContain('id="Bridge"');
    expect(svg).toContain('data-bn-value="51"');
    expect(svg).toContain('data-bn-value="25"');
  });

  it.each([
    [
      "totals with their own scale",
      { totals: { ...TOTALS, pixelPerUnit: 0.5 } },
      "the totals have their own unitScaling",
    ],
    ["totals per quarter", { totals: { ...TOTALS, by: "quarter" } }, "totals.by is not all"],
    ["an average", { totals: { ...TOTALS, aggregation: "average" } }, "totals.aggregation is not sum"],
    ["a walk that crosses the columns", { pixelPerUnit: 0.5 }, "the walk would cross the columns of the periods"],
  ])("falls back to the walk for %s", (_name, options, reason) => {
    const chart = buildChart({ ...BRIDGE, ...options });
    expect(internals(chart).bridge).toBeNull();
    expect(chart.getBridgeFallback()).toBe(reason);
    expect(buildChart({ ...BRIDGE, ...options, variances: ABSOLUTE }).isBridgeTier()).toBe(false);
  });

  it("falls back when the walk does not end at the total", () => {
    // the plan of March is missing: the reference total has a gap, so the total has no reference
    const rows = [ROWS[0], ROWS[1], { date: "2025-03-01", operation: "+", fc1: 26 }, ROWS[3]];
    const chart = buildChart(BRIDGE, rows);
    expect(internals(chart).bridge).toBeNull();
    expect(chart.getBridgeFallback()).not.toBeNull();
  });

  it("falls back when the variances are not against the reference of the total", () => {
    // the plan is the reference of the total, the previous year sums up to the same value
    const rows = [
      { date: "2025-01-01", operation: "+", ac1: 30, pp1: 20, pl1: 25 },
      { date: "2025-02-01", operation: "+", ac1: 30, pp1: 30, pl1: 25 },
      { date: "2025-03-01", operation: "+", ac1: 30, pp1: 25, pl1: 25 },
    ];
    const options = { scenarios: ["ac1", "pp1", "pl1"], scenarioSwitch: false, pixelPerUnit: 4 };
    const other = buildChart({ ...BRIDGE, ...options, bridgeVariances: ["dac1_pp1_pos"] }, rows);
    expect(internals(other).bridge).toBeNull();
    expect(other.getBridgeFallback()).toBe("the variances are not the series against the reference of the total");
  });

  it("reports that the totals are not drawn", () => {
    // a total that is not positive gives no total columns
    const rows = [
      { date: "2025-01-01", operation: "+", ac1: -40, pl1: 50 },
      { date: "2025-02-01", operation: "+", ac1: 15, pl1: 50 },
    ];
    const chart = buildChart({ ...BRIDGE, scenarios: ["ac1", "pl1"], bridgeVariances: ["dac1_pl1_pos"] }, rows);
    expect(chart.getBridgeFallback()).toBe("the chart draws no total columns");
  });

  it("reports nothing without totals or without the attribute", () => {
    expect(buildChart({ varianceWaterfall: true, bridgeVariances: ABSOLUTE }).getBridgeFallback()).toBeNull();
    expect(buildChart({ totals: TOTALS }).getBridgeFallback()).toBeNull();
  });
});

describe("time chart reference column", () => {
  it("is the reference of a series with a scenario switch", () => {
    // the slots follow the ruleset: FC takes the second one, the plan the third
    expect(internals(buildChart({ referenceColumn: true })).referenceColumnSlot()).not.toBeNull();
    expect(internals(buildChart({})).referenceColumnSlot()).toBeNull();
  });

  it("has no effect without a scenario switch", () => {
    const chart = buildChart({ referenceColumn: true, scenarioSwitch: false });
    expect(internals(chart).referenceColumnSlot()).toBeNull();
  });
});
