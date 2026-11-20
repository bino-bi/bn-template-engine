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
import { countPrimaryDataPoints } from "../../../utils/layoutState/svgChartElements";

const TABLE = "incidents";

// mock-doc has no getBBox. `apart`: every measured box lies next to the one before, so no two labels meet.
let apart = true;
let measured = 0;
beforeAll(() => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const proto = Object.getPrototypeOf(node) as { getBBox?: () => unknown };
  proto.getBBox = () => ({ x: apart ? 20 * measured++ : 0, y: 0, width: 10, height: 10 });
});
beforeEach(() => {
  apart = true;
  measured = 0;
});

const SERIES = ["Priority 1", "Priority 2", "Priority 3"];
const MONTHS = ["2024-11-01", "2024-12-01", "2025-01-01", "2025-02-01"];

// three series over four months, 100, 200 and 300 in each
const ROWS = MONTHS.flatMap((date) =>
  SERIES.map((name, index) => ({
    date,
    operation: "+",
    category: name,
    categoryIndex: index,
    ac1: 100 * (index + 1),
  })),
);

const STACK = { by: "dimensions", mode: "absolute", order: "dataset", notation: "none", legend: "right" };

const buildChart = (options: Record<string, unknown> = {}, rows: Record<string, unknown>[] = ROWS): TimeChart => {
  const db = createScopedDb().db;
  db.tables[TABLE] = { data: rows };

  const config = new TimeChartComponentConfigAdapter(
    new TimeChartDataRowAdapter(),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1"],
    dateInterval: "month",
    chartMode: "line",
    pixelPerUnit: 1,
    pixelPerPercentage: 10,
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

  return new TimeChart(new IBCSRuleSet(), db, TABLE, config, styles, 800);
};

const draw = (chart: TimeChart): Svg => {
  const svg = SVG().addTo(document.body) as Svg;
  chart.draw(svg);
  return svg;
};

const all = (svg: Svg, selector: string): Element[] => Array.from(svg.node.querySelectorAll(selector));
const texts = (svg: Svg, selector: string): string[] => all(svg, selector).map((node) => node.textContent ?? "");
const fills = (svg: Svg): (string | null)[] =>
  all(svg, '#StackedAreaScenarios > g[id^="area_fill_"] > path').map((path) => path.getAttribute("fill"));

describe("stacked area by dimension", () => {
  it("draws one layer per series in the colours of the stack", () => {
    const svg = draw(buildChart());
    expect(fills(svg)).toEqual(["#000000", "#c0c0c0", "#808080"]);
  });

  it("is as high as the sum of its series", () => {
    const chart = buildChart() as unknown as { highestDataPointValue: { value: number } };
    expect(chart.highestDataPointValue.value).toBe(600);
  });

  it("prints the value of each layer and the total of each period", () => {
    const svg = draw(buildChart());
    const values = texts(svg, '#StackedAreaLabels [data-bn-part="label"] text');
    expect(values).toHaveLength(SERIES.length * MONTHS.length);
    expect(values.filter((text) => text.startsWith("300"))).toHaveLength(MONTHS.length);
    const totals = texts(svg, '#StackedAreaLabels [data-bn-part="total"] text');
    expect(totals).toHaveLength(MONTHS.length);
    expect(totals.every((text) => text.startsWith("600"))).toBe(true);
  });

  it("leaves out a label that lies on another one", () => {
    apart = false;
    const svg = draw(buildChart());
    // the names of the series stay
    expect(texts(svg, "#StackedAreaLabels text").filter((text) => !text.startsWith("Priority"))).toHaveLength(1);
  });

  it("draws the total as a line with a marker at each period", () => {
    const svg = draw(buildChart());
    expect(all(svg, "#StackedAreaTotal polyline")).toHaveLength(1);
    expect(all(svg, "#StackedAreaTotal .area-total-marker")).toHaveLength(MONTHS.length);
  });

  it("has no total line in a 100 % stack", () => {
    const svg = draw(buildChart({ stackConfig: { ...STACK, mode: "relative" } }));
    expect(all(svg, "#StackedAreaTotal")).toHaveLength(0);
    expect(all(svg, '#StackedAreaLabels [data-bn-part="total"]')).toHaveLength(0);
  });

  it("prints the names of the series on the side of the legend", () => {
    const names = (legend: string): string[] =>
      texts(draw(buildChart({ stackConfig: { ...STACK, legend } })), "#StackedAreaLabels text").filter((text) =>
        text.startsWith("Priority"),
      );
    expect(names("right")).toEqual(SERIES);
    expect(names("both")).toEqual([...SERIES, ...SERIES]);
    expect(names("none")).toEqual([]);
  });

  it("stays one area for a dataset without categories", () => {
    const rows = MONTHS.map((date) => ({ date, operation: "+", ac1: 100 }));
    const svg = draw(buildChart({}, rows));
    expect(fills(svg)).toHaveLength(1);
    expect(all(svg, "#StackedAreaLabels")).toHaveLength(0);
  });

  it("draws a line at every n-th period in place of the year line", () => {
    const plain = draw(buildChart());
    expect(all(plain, ".period-line")).toHaveLength(0);
    expect(all(plain, "#YearSeparators line")).toHaveLength(1);

    const lined = draw(buildChart({ periodLines: 2 }));
    expect(all(lined, ".period-line")).toHaveLength(2);
    expect(all(lined, "#YearSeparators line")).toHaveLength(0);
  });

  it("puts a point on the right border of its period with pointPosition end", () => {
    const firstX = (svg: Svg): number => Number(all(svg, "#StackedAreaTotal .area-total-marker")[0].getAttribute("x"));
    const secondX = (svg: Svg): number => Number(all(svg, "#StackedAreaTotal .area-total-marker")[1].getAttribute("x"));
    const center = draw(buildChart());
    const end = draw(buildChart({ pointPosition: "end" }));
    const period = secondX(center) - firstX(center);
    expect(firstX(end) - firstX(center)).toBeCloseTo(period / 2, 5);
  });

  it("prints the year in a second row with two-row labels", () => {
    const svg = draw(buildChart({ axisLabelsMode: "two-row" }));
    expect(texts(svg, "#ScenarioSwitch text")).toEqual(["2024", "2025"]);
    expect(texts(svg, "#AxisAndDateLabelsLine text").some((text) => /\d{4}/.test(text))).toBe(false);
  });

  it("prints every n-th category label with axisLabelsStep", () => {
    const count = (step: number): number =>
      texts(draw(buildChart({ axisLabelsMode: "short", axisLabelsStep: step })), "#AxisAndDateLabelsLine text").filter(
        (text) => text !== "",
      ).length;
    expect(count(1)).toBe(MONTHS.length);
    expect(count(2)).toBe(MONTHS.length / 2);
  });

  it("puts the total line of a negative stack on its lower edge, with the label", () => {
    const rows = ROWS.map((row) => ({ ...row, ac1: -(row.ac1 as number) }));
    const svg = draw(buildChart({}, rows));
    const fillYs = all(svg, "#area_fill_2 path").flatMap((path) =>
      (path.getAttribute("d") ?? "").match(/,(-?[\d.]+)/g)!.map((part) => Number(part.slice(1))),
    );
    const marker = all(svg, "#StackedAreaTotal .area-total-marker")[0];
    // the middle of the marker is the lowest point of the last layer
    expect(Number(marker.getAttribute("y")) + 4).toBeCloseTo(Math.max(...fillYs), 5);
  });

  it("has no total and still all names for a period without a value", () => {
    const rows = [...ROWS, { date: "2025-03-01", operation: "+", category: "Priority 1", categoryIndex: 0, pl1: 5 }];
    const svg = draw(buildChart({}, rows));
    expect(all(svg, "#StackedAreaTotal .area-total-marker")).toHaveLength(MONTHS.length);
    expect(all(svg, '#StackedAreaLabels [data-bn-part="total"]')).toHaveLength(MONTHS.length);
    expect(texts(svg, "#StackedAreaLabels text").filter((text) => text.startsWith("Priority"))).toEqual(SERIES);
  });

  it("prints the shares of a 100 % stack with the percent sign, also with percentMark", () => {
    const svg = draw(buildChart({ stackConfig: { ...STACK, mode: "relative", percentMark: true } }));
    const values = texts(svg, '#StackedAreaLabels [data-bn-part="label"] text');
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((text) => text.includes("%"))).toBe(true);
  });

  it("keeps the year line of a plain line chart with periodLines", () => {
    const rows = MONTHS.map((date) => ({ date, operation: "+", ac1: 100 }));
    const svg = draw(buildChart({ stackConfig: null, periodLines: 1 }, rows));
    expect(all(svg, "#YearSeparators line")).toHaveLength(1);
    expect(all(svg, ".period-line")).toHaveLength(0);
  });

  it("tells the layout state the number of periods of a plain line chart", () => {
    const rows = MONTHS.map((date) => ({ date, operation: "+", ac1: 100 }));
    const svg = draw(buildChart({ stackConfig: null }, rows));
    expect(countPrimaryDataPoints(svg.node)).toBe(MONTHS.length);
  });

  it("tells the layout state the number of its periods", () => {
    const svg = draw(buildChart());
    expect(countPrimaryDataPoints(svg.node)).toBe(MONTHS.length);
  });
});
