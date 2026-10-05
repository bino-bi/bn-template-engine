import { G } from "@svgdotjs/svg.js";
import { TimeChart } from "./TimeChart";
import { Needle } from "./elements/Needle";
import { ElementPositions } from "./helper";
import { DataPoint } from "./model";
import { TimeChartComponentConfigAdapter } from "./model/TimeChartComponentConfig";
import { TimeChartDataRowAdapter } from "./model/TimeChartDataRow";
import { TimeChartStyle, TimeChartStylesAdapter } from "./model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "./model/styles/ScaleFactorsTimeChart";
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

const TABLE = "trend";

const buildChart = (): TimeChart => {
  const scoped = createScopedDb();
  const db = scoped.db;
  db.tables[TABLE] = {
    data: [
      { date: "2026-01-01", category: "Total", categoryIndex: 1, operation: "+", ac1: 100, pp1: 0 },
      { date: "2026-02-01", category: "Total", categoryIndex: 1, operation: "+", ac1: -50, pp1: -100 },
      { date: "2026-03-01", category: "Total", categoryIndex: 1, operation: "+", ac1: 110, pp1: 100 },
      // pp1 of April sums to -8.5e-14: 0 up to float rounding
      { date: "2026-04-01", category: "Total", categoryIndex: 1, operation: "+", ac1: 30, pp1: 1234.56 },
      { date: "2026-04-01", category: "Total", categoryIndex: 1, operation: "+", ac1: 0, pp1: -1000.1 },
      { date: "2026-04-01", category: "Total", categoryIndex: 1, operation: "+", ac1: 0, pp1: -234.46 },
    ],
  };

  const config = new TimeChartComponentConfigAdapter(
    new TimeChartDataRowAdapter(),
    new OrderAdapter(new StringAdapter()),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1", "pp1"],
    variances: ["drac1_pp1_pos"],
    level: "category",
    dateInterval: "month",
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
  variancesDataModel: { scenario1: DataPoint }[];
  smallestVarianceDataPointValue: DataPoint;
  highestVarianceDataPointValue: DataPoint;
  position: ElementPositions;
  styles: TimeChartStyle;
}

const internals = (chart: TimeChart): ChartInternals => chart as unknown as ChartInternals;

const variance = (chart: TimeChart, index: number): number | null | undefined =>
  internals(chart).variancesDataModel[index].scenario1.value;

/** Stand-in for a svg.js group: records the calls on itself, every group() gives a new stand-in. */
interface FakeGroup {
  calls: [string, unknown[]][];
  groups: FakeGroup[];
  node: unknown;
}

const fakeGroup = (): FakeGroup => {
  const fake: FakeGroup = { calls: [], groups: [], node: undefined };
  fake.node = new Proxy(() => undefined, {
    get: (_target, name) => {
      if (typeof name === "symbol") return undefined;
      if (name === "toString" || name === "valueOf") return () => "g";
      return (...args: unknown[]) => {
        fake.calls.push([name, args]);
        if (name !== "group") return fake.node;
        const child = fakeGroup();
        fake.groups.push(child);
        return child.node;
      };
    },
  });
  return fake;
};

const callNames = (group: FakeGroup): string[] => group.calls.map(([name]) => name);

describe("time chart relative variance", () => {
  it("divides by the absolute reference: -50 against -100 is +50%", () => {
    // (-50 + 100) / |-100| = 0.5
    expect(variance(buildChart(), 1)).toBeCloseTo(0.5);
  });

  it("has no value for a reference of 0", () => {
    expect(variance(buildChart(), 0)).toBeUndefined();
  });

  it("has no value for a reference that is 0 up to float rounding", () => {
    expect(variance(buildChart(), 3)).toBeUndefined();
  });

  it("keeps a reference of 0 out of the scaling", () => {
    const chart = internals(buildChart());

    expect(chart.highestVarianceDataPointValue.value).toBeCloseTo(0.5);
    expect(Number.isFinite(chart.smallestVarianceDataPointValue.value)).toBe(true);
  });

  it("prints n/a and draws no pin for a reference of 0", () => {
    const chart = internals(buildChart());
    const needleLayer = fakeGroup();
    const labelLayer = fakeGroup();

    // built like ScenarioFactory.createRelativeVarianceBar
    new Needle(chart.position, chart.styles, chart.variancesDataModel[0].scenario1, 0, needleLayer.node as G)
      .updateLabelGroup(labelLayer.node as G)
      .draw();

    // the first group the needle asks for holds the pin
    const [pin] = needleLayer.groups;
    expect(labelLayer.calls).toContainEqual(["text", ["n/a"]]);
    expect(callNames(pin)).not.toContain("rect");
    expect(callNames(pin)).not.toContain("polygon");
  });
});
