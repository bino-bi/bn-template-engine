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

// AC for 2024 and 2025, PL for 2026 and 2027, a reference (pp1) for every year
const ROWS = [
  { date: "2024-01-01", operation: "+", ac1: 100, pp1: 80 },
  { date: "2025-01-01", operation: "+", ac1: 120, pp1: 80 },
  { date: "2026-01-01", operation: "+", pl1: 400, pp1: 80 },
  { date: "2027-01-01", operation: "+", pl1: 60, pp1: 80 },
];

const buildChart = (options: Record<string, unknown>, rows: Record<string, unknown>[] = ROWS): TimeChart => {
  const db = createScopedDb().db;
  db.tables[TABLE] = { data: rows };

  const config = new TimeChartComponentConfigAdapter(
    new TimeChartDataRowAdapter(),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1", "pl1", "pp1"],
    dateInterval: "year",
    pixelPerUnit: 1,
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

interface ChartInternals {
  title: string;
  variancesDataModel: { scenario1: DataPoint }[];
  followerSlots(): string[];
  switchRuns(): { scenario: string; from: number; to: number }[];
}

const internals = (chart: TimeChart): ChartInternals => chart as unknown as ChartInternals;

describe("time chart scenarioSwitch", () => {
  it("has no follower without the switch", () => {
    const chart = buildChart({});
    expect(internals(chart).followerSlots()).toEqual([]);
    expect(internals(chart).switchRuns()).toEqual([]);
  });

  it("takes a scenario that only has values where the first has none as follower", () => {
    const chart = buildChart({ scenarioSwitch: true });
    // pp1 has a value in every year, so it is no follower
    expect(internals(chart).switchRuns()).toEqual([
      { scenario: "ac1", from: 0, to: 1 },
      { scenario: "pl1", from: 2, to: 3 },
    ]);
  });

  it("has no follower when the scenarios overlap", () => {
    const rows = ROWS.map((row) => ({ ...row, pl1: 50 }));
    const chart = buildChart({ scenarioSwitch: true }, rows);
    expect(internals(chart).switchRuns()).toEqual([]);
  });

  it("adds a row for the scenario names to the height", () => {
    const plain = buildChart({});
    const switched = buildChart({ scenarioSwitch: true });
    plain.layout();
    switched.layout();
    expect(switched.getAllocatedCanvasHeight()).toBeGreaterThan(plain.getAllocatedCanvasHeight());
  });

  it("draws the separator and the names", () => {
    const svg = buildChart({ scenarioSwitch: true }).toString();
    expect(svg).toContain('id="ScenarioSwitch"');
    expect(svg).toContain("scenario-switch");
  });

  it("puts variances over the same reference in one row", () => {
    const chart = buildChart({ scenarioSwitch: true, variances: ["dac1_pp1_pos", "dpl1_pp1_pos"] });
    const points = internals(chart).variancesDataModel.map((entry) => entry.scenario1);
    expect(points.map((point) => point.value)).toEqual([20, 40, 320, -20]);
    expect(points.map((point) => point.notation)).toEqual(["ac", "ac", "pl", "pl"]);
    expect(chart.getVarianceOverlaps()).toBe(0);
  });

  it("keeps one row per variance without the switch", () => {
    const chart = buildChart({ variances: ["dac1_pp1_pos"] });
    const points = internals(chart).variancesDataModel.map((entry) => entry.scenario1);
    expect(points).toHaveLength(4);
    expect(points[0].notation).toBeUndefined();
  });

  it("gives a single variance the notation of its scenario, and names the row by the reference", () => {
    const chart = buildChart({ scenarioSwitch: true, variances: ["dpl1_pp1_pos"] });
    const points = internals(chart).variancesDataModel.map((entry) => entry.scenario1);
    expect(points[2].notation).toBe("pl");
    const actual = buildChart({ scenarioSwitch: true, variances: ["dac1_pp1_pos"] });
    expect(internals(chart).title).toBe(internals(actual).title);
    expect(internals(buildChart({ variances: ["dpl1_pp1_pos"] })).title).not.toBe(internals(actual).title);
  });

  it("keeps the full name of a variance that is not one of the series", () => {
    // pp1 has values in every year: it is the reference, not a part of the series
    const chart = buildChart({ scenarioSwitch: true, variances: ["dpp1_ac1_pos"] });
    const plain = buildChart({ variances: ["dpp1_ac1_pos"] });
    expect(internals(chart).title).toBe(internals(plain).title);
  });

  it("hatches the variances and the pin heads of a forecast", () => {
    const rows = ROWS.map((row) => ("pl1" in row ? { date: row.date, operation: "+", fc1: row.pl1, pp1: 80 } : row));
    const options = { scenarios: ["ac1", "fc1", "pp1"], scenarioSwitch: true };
    const hatched = (variances: string[]): number =>
      buildChart({ ...options, variances }, rows)
        .toString()
        .match(/fill="url\(#pattern-hatch-/g).length;
    expect(hatched(["dac1_pp1_pos", "dfc1_pp1_pos"])).toBe(2);
    // the pin of 2026 is cut and has an arrow, not a head
    expect(hatched(["drac1_pp1_pos", "drfc1_pp1_pos"])).toBe(1);
    const plain = buildChart({ ...options, variances: ["dac1_pp1_pos"] }, rows).toString();
    expect(plain).not.toContain("pattern-hatch-");
  });

  it("prints relative variances without the percent sign on request", () => {
    const labels = (svg: string): string[] => Array.from(svg.matchAll(/>([^<>]*\d[^<>]*)<\/tspan>/g)).map((m) => m[1]);
    const options = { variances: ["drac1_pp1_pos"], scenarios: ["ac1", "pp1"] };
    const signed = labels(buildChart(options).toString());
    expect(signed.some((text) => text.includes("%"))).toBe(true);
    const plain = labels(
      buildChart({ ...options, dataFormatDigits: { percent: 1, decimal: 1, percentSign: false } }).toString(),
    );
    expect(plain.some((text) => text.includes("%"))).toBe(false);
    expect(plain).toEqual(expect.arrayContaining(["+25,0", "+50,0"]));
  });

  it("counts the periods where shared variances overlap", () => {
    const rows = ROWS.map((row) => ({ ...row, ac1: 100, pl1: 50 }));
    const chart = buildChart({ scenarioSwitch: true, variances: ["dac1_pp1_pos", "dpl1_pp1_pos"] }, rows);
    expect(chart.getVarianceOverlaps()).toBe(4);
    expect(internals(chart).variancesDataModel[0].scenario1.value).toBe(20);
  });
});

describe("time chart relative variance cut", () => {
  const relative = { variances: ["drpl1_pp1_pos"] };

  it("cuts at 145 % by default", () => {
    const chart = buildChart(relative);
    const point = internals(chart).variancesDataModel[2].scenario1;
    expect(point.value).toBe(4);
    expect(point.isClipped()).toBe(true);
    expect(point.getScaledPercentUnit()).toBeCloseTo(14.5);
  });

  it("lifts the cut when the full pin fits", () => {
    const chart = buildChart(relative);
    chart.fitRelativeVariances(10000);
    const point = internals(chart).variancesDataModel[2].scenario1;
    expect(point.isClipped()).toBe(false);
    expect(point.getScaledPercentUnit()).toBeCloseTo(40);
  });

  it("keeps the cut without room or without a known height", () => {
    for (const height of [0, 20]) {
      const chart = buildChart(relative);
      chart.fitRelativeVariances(height);
      expect(internals(chart).variancesDataModel[2].scenario1.isClipped()).toBe(true);
    }
  });
});

describe("time chart category labels", () => {
  const labels = (svg: string): string[] => Array.from(svg.matchAll(/>(\D?\d\d)<\/tspan>/g)).map((match) => match[1]);

  it("prints every label by default", () => {
    const svg = buildChart({ axisLabelsMode: "short", scenarios: ["pp1"] }).toString();
    expect(labels(svg)).toEqual(expect.arrayContaining(["24", "25", "26", "27"]));
  });

  it("prints every second label with axisLabelsStep 2", () => {
    const svg = buildChart({ axisLabelsMode: "short", scenarios: ["pp1"], axisLabelsStep: 2 }).toString();
    expect(labels(svg)).toEqual(expect.arrayContaining(["24", "26"]));
    expect(labels(svg)).not.toContain("25");
    expect(labels(svg)).not.toContain("27");
  });

  it("takes the short year pattern from the translations", () => {
    const chart = buildChart({ axisLabelsMode: "short", scenarios: ["pp1"] });
    chart.setI18n(new Map([["date-format-short-year", "’yy"]]));
    expect(chart.toString()).toContain("’24");
  });

  it("puts the axis title on the right or leaves it out", () => {
    const left = buildChart({ title: "Sales", scenarios: ["pp1"] }).toString();
    const none = buildChart({ title: "Sales", scenarios: ["pp1"], axisTitlePosition: "none" }).toString();
    expect(left).toContain("Sales");
    expect(none).not.toContain("Sales");
  });

  it("keeps the label that carries the year in smart mode", () => {
    const rows = Array.from({ length: 6 }, (_, month) => ({
      date: `202${month < 4 ? 4 : 5}-${String(((month + 8) % 12) + 1).padStart(2, "0")}-01`,
      operation: "+",
      pp1: 10,
    }));
    // Sep 2024 to Feb 2025: January has index 4, February index 5
    const svg = buildChart({ scenarios: ["pp1"], dateInterval: "month", axisLabelsStep: 5 }, rows).toString();
    expect(svg).toContain("2025");
  });
});

describe("time chart scaling indicator", () => {
  it("draws no band by default", () => {
    expect(buildChart({ scenarios: ["ac1", "pp1"] }).toString()).not.toContain("ScalingIndicator");
  });

  it("draws a band up to the value behind the columns, and the value", () => {
    const svg = buildChart({ scenarios: ["ac1", "pp1"], scalingIndicator: 100 }).toString();
    // pixelPerUnit is 1: the band is 100 high
    expect(svg).toMatch(/<g id="ScalingIndicator"><rect[^>]*height="100"/);
    expect(svg.indexOf('id="ScalingIndicator"')).toBeLessThan(svg.indexOf('id="Scenarios"'));
    expect(svg).toMatch(/SCALING_INDICATOR[\s\S]*>100,0<\/tspan>/);
  });

  it("counts the band for the height of the chart", () => {
    const low = buildChart({ scenarios: ["ac1", "pp1"], scalingIndicator: 100 });
    const high = buildChart({ scenarios: ["ac1", "pp1"], scalingIndicator: 1000 });
    low.layout();
    high.layout();
    // the highest column is 120
    expect(high.getAllocatedCanvasHeight() - low.getAllocatedCanvasHeight()).toBeCloseTo(880);
  });

  it("prints the value like a value label", () => {
    const rows = ROWS.map((row) => ("ac1" in row ? { ...row, ac1: 1200000 } : row));
    const svg = buildChart(
      {
        scenarios: ["ac1"],
        scalingIndicator: 1000000,
        measureScale: "k",
        dataFormatDigits: { percent: 1, decimal: 0 },
      },
      rows,
    ).toString();
    expect(svg).toMatch(/SCALING_INDICATOR[\s\S]*>1\.000<\/tspan>/);
  });

  it("draws no band in a variance chart", () => {
    const svg = buildChart({ scenarios: ["ac1", "pp1"], variances: ["dac1_pp1_pos"], scalingIndicator: 100 });
    expect(svg.toString()).not.toContain("ScalingIndicator");
  });
});
