// mock-doc cannot measure text
jest.mock("calculate-size", () => ({ __esModule: true, default: () => ({ width: 10, height: 10 }) }));

import { SVG, Svg } from "@svgdotjs/svg.js";
import { TimeChart } from "./TimeChart";
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
import { validateStackConfig } from "../../../utils/validate";

const TABLE = "sales";

// mock-doc has no getBBox: a fixed box is enough, the tests read no measured size
beforeAll(() => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const proto = Object.getPrototypeOf(node) as { getBBox?: () => unknown };
  proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
});

const SERIES = ["Software", "Service", "Training", "Consulting", "Other", "Hardware"];

// six series: AC for 2024 and 2025, FC for 2026, PL for 2027. Hardware has no value in 2025.
const ROWS = [2024, 2025, 2026, 2027].flatMap((year) =>
  SERIES.filter((name) => !(year === 2025 && name === "Hardware")).map((name, index) => {
    const slot = year <= 2025 ? "ac1" : year === 2026 ? "fc1" : "pl1";
    return { date: `${year}-01-01`, operation: "+", category: name, categoryIndex: index, [slot]: 10 * (index + 1) };
  }),
);

const STACK = {
  by: "dimensions",
  mode: "absolute",
  order: "dataset",
  notation: "none",
  legend: "left",
  percentMark: false,
};

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
    scenarios: ["ac1", "fc1", "pl1"],
    dateInterval: "year",
    pixelPerUnit: 1,
    pixelPerPercentage: 10,
    scenarioSwitch: true,
    stackConfig: STACK,
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

interface Segment {
  value: number;
  scenario: string;
  colorIndex?: number;
  label?: string;
}

interface ChartInternals {
  dataModel: Record<string, unknown>[];
  highestDataPointValue: { value: number };
  stackGroups(row: unknown): { segments: Segment[]; layout: { total: number } }[];
  switchRuns(): { scenario: string; from: number; to: number }[];
  contextRow(): { from: number; text: string }[];
  legendWidth(side: "left" | "right"): number;
}

const internals = (chart: TimeChart): ChartInternals => chart as unknown as ChartInternals;

const draw = (chart: TimeChart): Svg => {
  const svg = SVG().addTo(document.body) as Svg;
  chart.draw(svg);
  return svg;
};

const texts = (svg: Svg, selector: string): string[] =>
  Array.from(svg.node.querySelectorAll(selector)).map((node) => node.textContent ?? "");

describe("time chart stack by dimension", () => {
  it("stacks one segment per category, with no limit of four", () => {
    const chart = internals(buildChart({}));
    const [group] = chart.stackGroups(chart.dataModel[0]);
    expect(group.segments.map((segment) => segment.label)).toEqual(SERIES);
    expect(group.layout.total).toBe(210);
  });

  it("orders the series by categoryIndex", () => {
    const rows = ROWS.map((row) => ({ ...row, categoryIndex: 10 - (row.categoryIndex as number) }));
    const chart = internals(buildChart({}, rows));
    const [group] = chart.stackGroups(chart.dataModel[0]);
    expect(group.segments.map((segment) => segment.label)).toEqual([...SERIES].reverse());
  });

  it("keeps place and colour of a series that has no value in a period", () => {
    const chart = internals(buildChart({}));
    const [group] = chart.stackGroups(chart.dataModel[1]);
    expect(group.segments.map((segment) => segment.colorIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Number.isNaN(group.segments[5].value)).toBe(true);
    expect(group.layout.total).toBe(150);
  });

  it("keeps the colour of a series when the segments are sorted by value", () => {
    const chart = internals(buildChart({ stackConfig: { ...STACK, order: "desc" } }));
    const [group] = chart.stackGroups(chart.dataModel[0]);
    expect(group.segments.map((segment) => segment.colorIndex)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("stacks the scenario that has values in the period", () => {
    const chart = internals(buildChart({}));
    const scenarios = chart.dataModel.map((row) => chart.stackGroups(row)[0].segments[0].scenario);
    expect(scenarios).toEqual(["ac1", "ac1", "fc1", "pl1"]);
    expect(chart.switchRuns()).toEqual([
      { scenario: "ac1", from: 0, to: 1 },
      { scenario: "fc1", from: 2, to: 2 },
      { scenario: "pl1", from: 3, to: 3 },
    ]);
  });

  it("draws only the first scenario without the switch", () => {
    const chart = internals(buildChart({ scenarioSwitch: false }));
    expect(chart.stackGroups(chart.dataModel[2])).toEqual([]);
    expect(chart.switchRuns()).toEqual([]);
  });

  it("draws a scenario that overlaps the first one as the column behind the stack", () => {
    const rows = ROWS.map((row) => ("ac1" in row ? { ...row, pl1: 50 } : row));
    const chart = buildChart({ scenarios: ["ac1", "pl1"] }, rows);
    expect(chart.getIgnoredSwitchScenarios()).toEqual([]);
    expect(internals(chart).stackGroups(internals(chart).dataModel[0])[0].layout.total).toBe(210);
    // 2024 has six series with 50 each: the reference is higher than the stack of 210
    expect(internals(chart).highestDataPointValue.value).toBe(300);
    const svg = draw(chart);
    expect(svg.node.querySelectorAll("#StackReference #Scenario2 > g").length).toBe(4);
    expect(svg.node.querySelector("#StackReference ~ #StackedScenarios")).not.toBeNull();
  });

  it("reports a second scenario that overlaps, and one in a 100 % stack", () => {
    const rows = ROWS.map((row) => ("ac1" in row ? { ...row, pl1: 5, pp1: 5 } : row));
    expect(buildChart({ scenarios: ["ac1", "pl1", "pp1"] }, rows).getIgnoredSwitchScenarios()).toEqual(["pp1"]);
    const relative = buildChart({ scenarios: ["ac1", "pl1"], stackConfig: { ...STACK, mode: "relative" } }, rows);
    expect(relative.getIgnoredSwitchScenarios()).toEqual(["pl1"]);
    expect(draw(relative).node.querySelector("#StackReference")).toBeNull();
    expect(buildChart({}).getIgnoredSwitchScenarios()).toEqual([]);
  });

  it("fills a series without a value from the scenario that has it", () => {
    // one year in two parts: the months with actual values and the months of the forecast
    const rows = [
      { date: "2025-01-01", operation: "+", category: "AC", categoryIndex: 1, ac1: 100, pp1: 90 },
      { date: "2025-01-01", operation: "+", category: "FC", categoryIndex: 2, fc1: 40, pp1: 30 },
    ];
    const chart = buildChart(
      { scenarios: ["ac1", "fc1", "pp1"], stackConfig: { ...STACK, notation: "scenario" } },
      rows,
    );
    const [group] = internals(chart).stackGroups(internals(chart).dataModel[0]);
    expect(group.segments.map((segment) => segment.scenario)).toEqual(["ac1", "fc1"]);
    expect(group.layout.total).toBe(140);
    expect(chart.getIgnoredSwitchScenarios()).toEqual([]);
    const svg = draw(chart);
    const fills = Array.from(svg.node.querySelectorAll('#StackedScenarios g[id^="stacked_col_0_"] rect')).map(
      (rect) => rect.getAttribute("fill") ?? "",
    );
    expect(fills[0].startsWith("#")).toBe(true);
    expect(fills[1].startsWith("url(#pattern-stack-fc-")).toBe(true);
    // pp1 is the column behind
    expect(svg.node.querySelectorAll("#StackReference #Scenario2 > g").length).toBe(1);
  });

  it("does not fill without the switch", () => {
    const rows = [
      { date: "2025-01-01", operation: "+", category: "AC", categoryIndex: 1, ac1: 100 },
      { date: "2025-01-01", operation: "+", category: "FC", categoryIndex: 2, fc1: 40 },
    ];
    const chart = internals(buildChart({ scenarios: ["ac1", "fc1"], scenarioSwitch: false }, rows));
    expect(chart.stackGroups(chart.dataModel[0])[0].layout.total).toBe(100);
  });

  it("names the scenario of a chart with one scenario under the axis", () => {
    const chart = internals(buildChart({ scenarios: ["ac1"] }));
    expect(chart.contextRow().map((entry) => entry.text)).toEqual(["AC"]);
  });

  it("draws the separators and one segment per series and period", () => {
    const svg = draw(buildChart({}));
    expect(svg.node.querySelectorAll(".scenario-switch").length).toBe(2);
    // 4 periods with 6 series, one without a value
    expect(svg.node.querySelectorAll('#StackedScenarios g[id^="stacked_col_"] rect').length).toBe(23);
  });
});

describe("time chart stack notation", () => {
  const fills = (svg: Svg, period: number): string[] =>
    Array.from(svg.node.querySelectorAll(`#StackedScenarios g[id^="stacked_col_${period}_"] rect`)).map(
      (rect) => rect.getAttribute("fill") ?? "",
    );

  it("draws solid segments without notation", () => {
    const svg = draw(buildChart({}));
    expect(fills(svg, 2).every((fill) => fill.startsWith("#"))).toBe(true);
  });

  it("hatches forecast segments and outlines plan segments", () => {
    const svg = draw(buildChart({ stackConfig: { ...STACK, notation: "scenario" } }));
    expect(fills(svg, 0).every((fill) => fill.startsWith("#"))).toBe(true);
    expect(fills(svg, 2).every((fill) => fill.startsWith("url(#pattern-stack-fc-"))).toBe(true);
    // plan: the first series takes the fill of the scenario, the others keep their shade
    const plan = fills(svg, 3);
    expect(plan[0]).toBe("#ffffff");
    expect(plan[1]).toBe("#c0c0c0");
    const strokes = Array.from(svg.node.querySelectorAll('#StackedScenarios g[id^="stacked_col_3_"] rect')).map(
      (rect) => rect.getAttribute("stroke-width"),
    );
    expect(strokes.every((width) => width === "1")).toBe(true);
  });
});

describe("time chart stack legend", () => {
  const headers = (svg: Svg): string[] => texts(svg, '#StackedHeaders g[id*="STACK_HEADER"] text');

  it("names the series at the left by default", () => {
    expect(headers(draw(buildChart({})))).toEqual(SERIES);
  });

  it("names them at the right, at both sides or nowhere", () => {
    expect(headers(draw(buildChart({ stackConfig: { ...STACK, legend: "right" } })))).toEqual(SERIES);
    expect(headers(draw(buildChart({ stackConfig: { ...STACK, legend: "both" } }))).length).toBe(12);
    expect(headers(draw(buildChart({ stackConfig: { ...STACK, legend: "none" } })))).toEqual([]);
  });

  it("reserves the width of the names on the side they stand", () => {
    expect(internals(buildChart({})).legendWidth("right")).toBe(0);
    expect(internals(buildChart({ stackConfig: { ...STACK, legend: "right" } })).legendWidth("right")).toBe(10);
    expect(internals(buildChart({ stackConfig: { ...STACK, legend: "none" } })).legendWidth("left")).toBe(0);
  });
});

describe("time chart 100 % mark", () => {
  const relative = { ...STACK, mode: "relative" };

  it("prints percent labels and no mark by default", () => {
    const svg = draw(buildChart({ stackConfig: relative, pixelPerUnit: 5 }));
    expect(svg.node.querySelectorAll(".percent-mark").length).toBe(0);
    expect(texts(svg, '#StackedScenarios g[id*="STACK_SEG"] text').some((text) => text.includes("%"))).toBe(true);
  });

  it("prints plain shares and one 100% mark", () => {
    const svg = draw(buildChart({ stackConfig: { ...relative, percentMark: true }, pixelPerUnit: 5 }));
    expect(svg.node.querySelectorAll(".percent-mark").length).toBe(1);
    expect(texts(svg, '#StackedHeaders g[id*="STACK_PERCENT_MARK"] text')).toEqual(["100%"]);
    const labels = texts(svg, '#StackedScenarios g[id*="STACK_SEG"] text');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((text) => text.includes("%"))).toBe(false);
  });
});

describe("time chart two-row axis labels", () => {
  // AC for Nov and Dec 2025, PL for Jan and Feb 2026
  const months = ["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"].flatMap((date, period) =>
    ["Software", "Service"].map((name, index) => ({
      date,
      operation: "+",
      category: name,
      categoryIndex: index,
      [period < 2 ? "ac1" : "pl1"]: 10,
    })),
  );
  const options = { scenarios: ["ac1", "pl1"], dateInterval: "month", axisLabelsMode: "two-row" };

  it("puts the year and the scenario name under the period where they start", () => {
    const chart = internals(buildChart(options, months));
    expect(chart.contextRow().map((entry) => [entry.from, entry.text])).toEqual([
      [0, "2025 AC"],
      [2, "2026 PL"],
    ]);
  });

  it("prints the year without a scenario switch", () => {
    const chart = internals(buildChart({ ...options, scenarioSwitch: false, scenarios: ["ac1"] }, months));
    expect(chart.contextRow().map((entry) => entry.text)).toEqual(["2025", "2026"]);
  });

  it("uses the week year for weeks around a year change", () => {
    const weeks = ["2025-12-22", "2025-12-29", "2026-01-05"].map((date) => ({
      date,
      operation: "+",
      category: "Software",
      categoryIndex: 0,
      ac1: 10,
    }));
    const chart = internals(
      buildChart({ scenarios: ["ac1"], scenarioSwitch: false, dateInterval: "week", axisLabelsMode: "two-row" }, weeks),
    );
    // 2025-12-29 is the Monday of week 1 of 2026
    expect(chart.contextRow().map((entry) => [entry.from, entry.text])).toEqual([
      [0, "2025"],
      [1, "2026"],
    ]);
  });

  it("has no second row and no legend width in line mode", () => {
    const chart = internals(buildChart({ ...options, chartMode: "line" }, months));
    expect(chart.contextRow()).toEqual([]);
    expect(chart.legendWidth("left")).toBe(0);
  });

  it("has no second row for years", () => {
    const chart = internals(buildChart({ axisLabelsMode: "two-row", scenarioSwitch: false, scenarios: ["ac1"] }));
    expect(chart.contextRow()).toEqual([]);
  });
});

describe("stack config validation", () => {
  it("accepts the new keys", () => {
    expect(validateStackConfig('{"by":"dimensions","notation":"scenario","legend":"both","percentMark":true}')).toEqual(
      [],
    );
  });

  it("rejects unknown values", () => {
    expect(validateStackConfig('{"by":"dimensions","notation":"x","legend":"top","percentMark":"yes"}').length).toBe(3);
  });
});
