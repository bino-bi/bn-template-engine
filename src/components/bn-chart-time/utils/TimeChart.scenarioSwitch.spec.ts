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
  totalColumns: {
    from: number;
    to: number;
    label: string;
    parts: { scenario: string; value: number }[];
    total: number;
    reference: { scenario: string; value: number } | null;
  }[];
  totalVariances: (DataPoint | null)[];
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
    // 14.5 % rounds up, as with the sign
    const rows = [{ date: "2024-01-01", operation: "+", ac1: 114.5, pp1: 100 }];
    const whole = { ...options, dataFormatDigits: { percent: 0, decimal: 1, percentSign: false } };
    expect(labels(buildChart(whole, rows).toString())).toContain("+15");
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

  it("does not cut columns for a band that does not fit", () => {
    const chart = buildChart({ scenarios: ["ac1", "pp1"], scalingIndicator: 1000 });
    chart.setAvailableHeight(400);
    // the columns fit: no break mark
    expect((chart as unknown as { overflowConfig: unknown }).overflowConfig).toBeNull();
  });

  it("draws no band above columns that are cut", () => {
    const rows = ROWS.map((row) => ("ac1" in row ? { ...row, ac1: 900 } : row));
    const chart = buildChart({ scenarios: ["ac1", "pp1"], scalingIndicator: 800 }, rows);
    chart.setAvailableHeight(400);
    expect(chart.toString()).not.toContain("ScalingIndicator");
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

describe("time chart total column", () => {
  const TOTAL = { totals: { pixelPerUnit: 0.1, label: "All years", width: 1.5 } };

  it("has no total column by default, with a stack or in line mode", () => {
    expect(internals(buildChart({})).totalColumns[0] ?? null).toBeNull();
    expect(buildChart({}).toString()).not.toContain("TotalColumn");
    const stack = { by: "scenarios", mode: "absolute", order: "dataset", notation: "none", legend: "left" };
    expect(internals(buildChart({ ...TOTAL, stackConfig: stack })).totalColumns[0] ?? null).toBeNull();
    expect(internals(buildChart({ ...TOTAL, chartMode: "line" })).totalColumns[0] ?? null).toBeNull();
  });

  it("sums the first scenario, with the first other scenario as the reference", () => {
    const total = internals(buildChart({ ...TOTAL, scenarios: ["ac1", "pp1"] })).totalColumns[0] ?? null;
    expect(total.parts).toEqual([{ scenario: "ac1", value: 220 }]);
    // the reference counts in the periods of the series: 2024 and 2025
    expect(total.reference).toEqual({ scenario: "pp1", value: 160 });
  });

  it("has one part per scenario of a switched series", () => {
    const total = internals(buildChart({ ...TOTAL, scenarioSwitch: true })).totalColumns[0] ?? null;
    expect(total.parts).toEqual([
      { scenario: "ac1", value: 220 },
      { scenario: "pl1", value: 460 },
    ]);
    expect(total.total).toBe(680);
    expect(total.reference).toEqual({ scenario: "pp1", value: 320 });
  });

  it("draws the parts, their names, the total, the label and its own axis", () => {
    const svg = buildChart({ ...TOTAL, scenarioSwitch: true, dataFormatDigits: { percent: 1, decimal: 0 } }).toString();
    expect(svg).toContain('id="TotalColumn"');
    // the reference and two parts
    expect(svg.match(/data-bn-row="total"[^>]*data-bn-part="element"/g)).toHaveLength(3);
    for (const text of ["220", "460", "680", "AC", "PL", "All years"]) {
      expect(svg).toContain(`>${text}</tspan>`);
    }
    expect(svg).toMatch(/<g id="TotalColumn">[\s\S]*<line[^>]*class="axis-/);
  });

  it("counts for the height of the chart, and causes no break mark", () => {
    const plain = buildChart({ scenarios: ["ac1", "pp1"] });
    const total = buildChart({ scenarios: ["ac1", "pp1"], totals: { pixelPerUnit: 2, label: "", width: 1 } });
    plain.layout();
    total.layout();
    // the total of 220 at 2 px per unit is 440 high, the highest column 120
    expect(total.getAllocatedCanvasHeight() - plain.getAllocatedCanvasHeight()).toBeCloseTo(320);
    total.setAvailableHeight(400);
    expect((total as unknown as { overflowConfig: unknown }).overflowConfig).toBeNull();
  });

  it("gives each variance row the variance of the totals", () => {
    const options = { ...TOTAL, scenarioSwitch: true };
    const absolute =
      internals(buildChart({ ...options, variances: ["dac1_pp1_pos", "dpl1_pp1_pos"] })).totalVariances[0] ?? null;
    expect(absolute.value).toBe(360);
    expect(absolute.key).toEqual({ row: "total", scenario: "dac1_pp1_pos" });
    expect(absolute.notation).toBe("ac");
    const relative =
      internals(buildChart({ ...options, variances: ["drac1_pp1_pos", "drpl1_pp1_pos"] })).totalVariances[0] ?? null;
    expect(relative.value).toBeCloseTo(1.125);
    const svg = buildChart({ ...options, variances: ["dac1_pp1_pos", "dpl1_pp1_pos"] }).toString();
    expect(svg).toMatch(/data-bn-row="total"/);
    expect(internals(buildChart({ variances: ["dac1_pp1_pos"] })).totalVariances[0] ?? null).toBeNull();
  });

  it("takes the notation of a forecast that is part of the total", () => {
    const rows = ROWS.map((row) => ("pl1" in row ? { date: row.date, operation: "+", fc1: row.pl1, pp1: 80 } : row));
    const chart = buildChart(
      { ...TOTAL, scenarios: ["ac1", "fc1", "pp1"], scenarioSwitch: true, variances: ["dac1_pp1_pos", "dfc1_pp1_pos"] },
      rows,
    );
    expect((internals(chart).totalVariances[0] ?? null).notation).toBe("fc");
  });

  it("has no total column when a part is not positive", () => {
    const rows = ROWS.map((row, index) => (index === 1 ? { ...row, ac1: -300 } : row));
    const options = { ...TOTAL, scenarios: ["ac1", "pp1"] };
    expect(internals(buildChart(options, rows)).totalColumns[0] ?? null).toBeNull();
    // the variance row and the width agree: no total anywhere
    expect(
      internals(buildChart({ ...options, variances: ["dac1_pp1_pos"] }, rows)).totalVariances[0] ?? null,
    ).toBeNull();
    const plain = buildChart({ scenarios: ["ac1", "pp1"] }, rows);
    const total = buildChart(options, rows);
    plain.layout();
    total.layout();
    expect(total.getAllocatedCanvasWidth()).toBe(plain.getAllocatedCanvasWidth());
  });

  it("does not cut period variances for the variance of the total", () => {
    const chart = buildChart({ ...TOTAL, scenarios: ["ac1", "pp1"], variances: ["dac1_pp1_pos"] });
    chart.setAvailableHeight(160);
    // the period variances are 20 and 40, the total 60... the row has room for the periods
    expect((chart as unknown as { overflowConfig: unknown }).overflowConfig).toBeNull();
  });

  it("lifts the cut of the total pin with the pins of the periods", () => {
    const rows = [
      { date: "2024-01-01", operation: "+", ac1: 100, pp1: 80 },
      { date: "2025-01-01", operation: "+", ac1: 400, pp1: 80 },
    ];
    const chart = buildChart({ ...TOTAL, scenarios: ["ac1", "pp1"], variances: ["drac1_pp1_pos"] }, rows);
    expect((internals(chart).totalVariances[0] ?? null).isClipped()).toBe(true);
    chart.fitRelativeVariances(100000);
    expect((internals(chart).totalVariances[0] ?? null).isClipped()).toBe(false);
  });

  it("counts the band of the total column for the height", () => {
    const options = { scenarios: ["ac1", "pp1"], totals: { pixelPerUnit: 5, label: "", width: 1 } };
    const plain = buildChart(options);
    const band = buildChart({ ...options, scalingIndicator: 400 });
    plain.layout();
    band.layout();
    // the total of 220 is 1100 high, the band of 400 is 2000 high
    expect(band.getAllocatedCanvasHeight() - plain.getAllocatedCanvasHeight()).toBeCloseTo(900);
  });

  it("draws the variance of the total inside the group of the variances, for the height of the row", () => {
    const svg = buildChart({ ...TOTAL, scenarios: ["ac1", "pp1"], variances: ["dac1_pp1_pos"] }).toString();
    expect(svg).toMatch(/<g id="Scenarios">[\s\S]*<g id="TotalColumn">/);
    expect(svg.indexOf('id="TotalColumn"')).toBeLessThan(svg.indexOf('id="AxisAndDateLables"'));
  });

  it("keeps the part above the break of a cut total variance inside its zone", () => {
    const rows = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map((year) => ({
      date: `${year}-01-01`,
      operation: "+",
      ac1: 300,
      pp1: 100,
    }));
    const chart = buildChart({ ...TOTAL, scenarios: ["ac1", "pp1"], variances: ["dac1_pp1_pos"] }, rows);
    chart.setAvailableHeight(150);
    const heights = Array.from(chart.toString().matchAll(/<rect[^>]*height="([\d.]+)"/g)).map((m) => Number(m[1]));
    // the total of 1600 is cut like the periods: no rect is higher than the room of the row
    expect(Math.max(...heights)).toBeLessThan(150);
  });

  it("draws no band in the segment of a variance that is not valid", () => {
    const svg = buildChart({ scenarios: ["ac1", "pp1"], variances: ["dfoo"], scalingIndicator: 50 }).toString();
    expect(svg).not.toContain("ScalingIndicator");
  });

  it("links the bands of the scaling indicator", () => {
    const svg = buildChart({ ...TOTAL, scenarios: ["ac1", "pp1"], scalingIndicator: 100 }).toString();
    expect(svg).toContain('id="ScalingIndicatorLink"');
    // 100 at 0.1 px per unit
    expect(svg).toMatch(/<g id="TotalColumn"><rect[^>]*height="10"/);
    expect(buildChart({ ...TOTAL, scenarios: ["ac1", "pp1"] }).toString()).not.toContain("ScalingIndicatorLink");
  });
});

describe("time chart totals by period", () => {
  // six months of AC, then three of FC, with a reference in every month
  const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((month) => ({
    date: `2025-0${month}-01`,
    operation: "+",
    ...(month <= 6 ? { ac1: 10 * month } : { fc1: 10 * month }),
    pp1: 50,
  }));
  const options = { scenarios: ["ac1", "fc1", "pp1"], scenarioSwitch: true, dateInterval: "month" };
  const totals = (extra: Record<string, unknown> = {}) => ({
    totals: { by: "quarter", aggregation: "sum", pixelPerUnit: 0.5, label: "", width: 1, dataset: "", ...extra },
  });
  const place = (chart: TimeChart, index: number): number =>
    (
      chart as unknown as { position: { getColumnCenterPositionX(i: number): number } }
    ).position.getColumnCenterPositionX(index);

  it("has one total per quarter, behind the last month of the quarter", () => {
    const chart = buildChart({ ...options, ...totals() }, MONTHS);
    const columns = internals(chart).totalColumns;
    expect(columns.map((column) => [column.from, column.to])).toEqual([
      [0, 2],
      [3, 5],
      [6, 8],
    ]);
    expect(columns.map((column) => column.total)).toEqual([60, 150, 240]);
    expect(columns[2].parts).toEqual([{ scenario: "fc1", value: 240 }]);
    expect(columns[0].reference).toEqual({ scenario: "pp1", value: 150 });
    // March, the total of the first quarter, April: each one place further
    const step = place(chart, 1) - place(chart, 0);
    expect(place(chart, 10) - place(chart, 2)).toBeCloseTo(step);
    expect(place(chart, 3) - place(chart, 10)).toBeCloseTo(step);
  });

  it("draws the line of the scenario switch behind the total between the two runs", () => {
    const chart = buildChart({ ...options, ...totals() }, MONTHS);
    const svg = chart.toString();
    const x = Number(/<line[^>]*x1="([\d.]+)"[^>]*class="scenario-switch"/.exec(svg)?.[1]);
    // June, the total of the second quarter, the line, July
    expect(x).toBeGreaterThan(place(chart, 11));
    expect(x).toBeLessThan(place(chart, 6));
  });

  it("names a total by its period and gives it the start of the period in its key", () => {
    const chart = buildChart({ ...options, ...totals(), variances: ["dac1_pp1_pos", "dfc1_pp1_pos"] }, MONTHS);
    expect(internals(chart).totalColumns.map((column) => column.label)).toHaveLength(3);
    expect(new Set(internals(chart).totalColumns.map((column) => column.label)).size).toBe(3);
    const variances = internals(chart).totalVariances;
    expect(variances.map((point) => point.value)).toEqual([-90, 0, 90]);
    expect(variances.map((point) => point.key)).toEqual([
      { row: "total", date: "2025-01-01", scenario: "dac1_pp1_pos" },
      { row: "total", date: "2025-04-01", scenario: "dac1_pp1_pos" },
      { row: "total", date: "2025-07-01", scenario: "dac1_pp1_pos" },
    ]);
    expect(variances.map((point) => point.notation)).toEqual(["ac", "ac", "fc"]);
  });

  it("keeps the periods in place without totals, and with one total at the end", () => {
    const plain = buildChart(options, MONTHS);
    const end = buildChart({ ...options, ...totals({ by: "all" }) }, MONTHS);
    for (const index of [0, 4, 8]) {
      expect(place(end, index)).toBeCloseTo(place(plain, index));
    }
    expect(internals(end).totalColumns).toHaveLength(1);
    expect(internals(end).totalColumns[0].parts).toEqual([
      { scenario: "ac1", value: 210 },
      { scenario: "fc1", value: 240 },
    ]);
  });

  it("takes the average as one column in the look of a forecast in it", () => {
    const chart = buildChart({ ...options, ...totals({ by: "all", aggregation: "average" }) }, MONTHS);
    const [column] = internals(chart).totalColumns;
    expect(column.parts).toEqual([{ scenario: "fc1", value: 50 }]);
    expect(column.reference).toEqual({ scenario: "pp1", value: 50 });
    const actual = buildChart({ ...options, ...totals({ aggregation: "average" }) }, MONTHS);
    expect(internals(actual).totalColumns[0].parts).toEqual([{ scenario: "ac1", value: 20 }]);
  });

  it("takes the last value of a group", () => {
    const chart = buildChart(
      { ...options, ...totals({ aggregation: "last" }), variances: ["dac1_pp1_pos", "dfc1_pp1_pos"] },
      MONTHS,
    );
    expect(internals(chart).totalColumns.map((column) => column.parts[0])).toEqual([
      { scenario: "ac1", value: 30 },
      { scenario: "ac1", value: 60 },
      { scenario: "fc1", value: 90 },
    ]);
    expect(internals(chart).totalVariances.map((point) => point.value)).toEqual([-20, 10, 40]);
  });

  it("takes the values from a dataset", () => {
    const year = [{ date: "2025-01-01", ac1: 400, fc1: 300, pp1: 650 }];
    const chart = buildChart({ ...options, ...totals({ by: "all", dataset: "year" }) }, MONTHS, { year });
    const [column] = internals(chart).totalColumns;
    expect(column.parts).toEqual([
      { scenario: "ac1", value: 400 },
      { scenario: "fc1", value: 300 },
    ]);
    expect(column.total).toBe(700);
    expect(column.reference).toEqual({ scenario: "pp1", value: 650 });
    const variance = buildChart(
      { ...options, ...totals({ by: "all", dataset: "year" }), variances: ["dac1_pp1_pos", "dfc1_pp1_pos"] },
      MONTHS,
      { year },
    );
    expect(internals(variance).totalVariances[0].value).toBe(50);
  });

  it("matches the rows of a dataset to the groups by their date", () => {
    const quarters = [
      { date: "2025-01-01", ac1: 100, pp1: 90 },
      { date: "2025-05-15", ac1: 200, pp1: 90 },
      { date: "2025-07-01", fc1: 300, pp1: 90 },
    ];
    const chart = buildChart({ ...options, ...totals({ dataset: "quarters" }) }, MONTHS, { quarters });
    expect(internals(chart).totalColumns.map((column) => column.total)).toEqual([100, 200, 300]);
  });

  it("has a total only where the dataset has a row, and takes a 0 or a text like the main dataset", () => {
    const quarters = [{ date: "2025-01-01", ac1: "100", fc1: 0, pp1: 90 }];
    const chart = buildChart({ ...options, ...totals({ dataset: "quarters" }) }, MONTHS, { quarters });
    const columns = internals(chart).totalColumns;
    expect(columns).toHaveLength(1);
    expect(columns[0].parts).toEqual([{ scenario: "ac1", value: 100 }]);
  });

  it("has no total for a group where the series has no value", () => {
    const rows = MONTHS.map((row, index) => (index < 3 ? row : { date: row.date, operation: "+", pp1: 50 }));
    const chart = buildChart({ ...options, ...totals(), scenarios: ["ac1", "pp1"], scenarioSwitch: false }, rows);
    expect(internals(chart).totalColumns.map((column) => [column.from, column.to])).toEqual([[0, 2]]);
  });

  it("takes the reference from the periods of the series", () => {
    const rows = MONTHS.map((row, index) => (index < 3 ? row : { date: row.date, operation: "+", pp1: 50 }));
    for (const aggregation of ["sum", "average", "last"]) {
      const chart = buildChart(
        {
          ...options,
          ...totals({ by: "all", aggregation }),
          scenarios: ["ac1", "pp1"],
          scenarioSwitch: false,
          variances: ["dac1_pp1_pos"],
        },
        rows,
      );
      const [column] = internals(chart).totalColumns;
      const variance = internals(chart).totalVariances[0].value;
      expect(column.total - column.reference.value).toBeCloseTo(variance);
    }
  });

  it("has no reference and no variance for a total when the reference has a gap in its periods", () => {
    const rows = [
      { date: "2025-01-01", operation: "+", ac1: 100, pp1: 90 },
      { date: "2025-02-01", operation: "+", ac1: 200 },
      { date: "2025-03-01", operation: "+", ac1: 120 },
    ];
    for (const aggregation of ["sum", "average", "last"]) {
      const chart = buildChart(
        {
          dateInterval: "month",
          scenarios: ["ac1", "pp1"],
          variances: ["dac1_pp1_pos"],
          ...totals({ by: "all", aggregation }),
        },
        rows,
      );
      expect(internals(chart).totalColumns[0].reference).toBeNull();
      expect(internals(chart).totalVariances[0]).toBeNull();
    }
  });

  it("does not take the notation of a scenario that is 0 in the dataset", () => {
    const year = [{ date: "2025-01-01", ac1: 300, fc1: 0, pp1: 500 }];
    const chart = buildChart(
      { ...options, ...totals({ by: "all", dataset: "year" }), variances: ["dac1_pp1_pos", "dfc1_pp1_pos"] },
      MONTHS,
      { year },
    );
    expect(internals(chart).totalVariances[0].value).toBe(-200);
    expect(internals(chart).totalVariances[0].notation).toBe("ac");
  });

  it("keeps room for a name right of the last period before its total", () => {
    // the first scenario runs to the last period: its name stands there
    const rows = MONTHS.map((row) => ({ date: row.date, operation: "+", ac1: 10, pp1: 5 }));
    const named = buildChart({ ...options, ...totals(), scenarios: ["ac1", "pp1"], scenarioSwitch: false }, rows);
    const switched = buildChart({ ...options, ...totals() }, MONTHS);
    const step = place(named, 1) - place(named, 0);
    // September is index 8, the total of the third quarter index 12
    expect(place(named, 12) - place(named, 8)).toBeCloseTo(2 * step);
    expect(place(switched, 12) - place(switched, 8)).toBeCloseTo(step);
  });

  it("draws one column for an average or a last value from a dataset", () => {
    const year = [{ date: "2025-01-01", ac1: 35, fc1: 80, pp1: 100 }];
    const chart = buildChart(
      { ...options, ...totals({ by: "all", aggregation: "average", dataset: "year" }) },
      MONTHS,
      {
        year,
      },
    );
    expect(internals(chart).totalColumns[0].parts).toEqual([{ scenario: "fc1", value: 115 }]);
  });

  it("gives a variance row for a part of the series no total from a dataset", () => {
    const year = [{ date: "2025-01-01", ac1: 400, fc1: 300, pp1: 650 }];
    const build = (variances: string[]) =>
      internals(buildChart({ ...options, ...totals({ by: "all", dataset: "year" }), variances }, MONTHS, { year }))
        .totalVariances[0];
    // the reference of the dataset is the one of the whole year, the row has the actual months only
    expect(build(["dac1_pp1_pos"])).toBeNull();
    expect(build(["dac1_pp1_pos", "dfc1_pp1_pos"]).value).toBe(50);
  });

  it("counts a week into the year of its Thursday", () => {
    // the week from 2025-12-29 is week 1 of 2026
    const weeks = ["2025-12-15", "2025-12-22", "2025-12-29", "2026-01-05"].map((date) => ({
      date,
      operation: "+",
      ac1: 10,
      pp1: 5,
    }));
    const chart = buildChart({ dateInterval: "week", scenarios: ["ac1", "pp1"], ...totals({ by: "year" }) }, weeks);
    expect(internals(chart).totalColumns.map((column) => [column.from, column.to])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("has no totals when every period would get its own", () => {
    const chart = buildChart({ ...options, ...totals({ by: "month" }) }, MONTHS);
    expect(internals(chart).totalColumns).toEqual([]);
  });

  it("keeps the end of the average line behind the last period, and the bands of the totals free", () => {
    const chart = buildChart({ ...options, ...totals(), scalingIndicator: 20, showOverlayAvg: true }, MONTHS);
    // the index behind the last period is one place behind the last total, not the place of a total
    expect(place(chart, 9)).toBeGreaterThan(place(chart, 12));
    const svg = chart.toString();
    const band = /<g id="ScalingIndicator">([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? "";
    // one piece per quarter
    expect(band.match(/<rect/g)).toHaveLength(3);
  });

  it("draws one column per total and no own axis on the axis of the periods", () => {
    const svg = buildChart({ ...options, ...totals(), scalingIndicator: 20 }, MONTHS).toString();
    expect(svg.match(/id="[^"]*TOTAL_LABEL[^"]*"/g) ?? svg.match(/TOTAL_LABEL/g)).not.toBeNull();
    expect(svg).not.toContain("ScalingIndicatorLink");
    expect(svg).not.toMatch(/<g id="TotalColumn">[\s\S]*?<line[^>]*class="axis-/);
  });
});
