import { G } from "@svgdotjs/svg.js";
import { StructureChart } from "./StructureChart";
import { Needle } from "./elements/Needle";
import { ElementPositions } from "./helper";
import {
  DataPoint,
  ScaleFactorsStructureChartAdapter,
  StructureChartComponentConfigAdapter,
  StructureChartDataRowAdapter,
  StructureChartStyle,
} from "./model";
import { StructureChartStylesAdapter } from "./model/styles/StructureChartStyle";
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

const TABLE = "products";

const buildChart = (): StructureChart => {
  const scoped = createScopedDb();
  const db = scoped.db;
  db.tables[TABLE] = {
    data: [
      { operation: "+", category: "A", categoryIndex: 1, ac1: 100, pp1: 0 },
      { operation: "+", category: "B", categoryIndex: 2, ac1: -50, pp1: -100 },
      { operation: "+", category: "C", categoryIndex: 3, ac1: 110, pp1: 100 },
    ],
  };

  const config = new StructureChartComponentConfigAdapter(
    new StructureChartDataRowAdapter(),
    new OrderAdapter(new StringAdapter()),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1", "pp1"],
    variances: ["drac1_pp1_pos"],
    level: "category",
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

interface ChartInternals {
  variancesDataModel: { category: string; scenario1: DataPoint }[];
  smallestVarianceDataPointValue: DataPoint;
  highestVarianceDataPointValue: DataPoint;
  position: ElementPositions;
  styles: StructureChartStyle;
}

const internals = (chart: StructureChart): ChartInternals => chart as unknown as ChartInternals;

const variancePoint = (chart: StructureChart, category: string): DataPoint =>
  internals(chart).variancesDataModel.find((entry) => entry.category === category)!.scenario1;

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

describe("structure chart relative variance", () => {
  it("divides by the absolute reference: -50 against -100 is +50%", () => {
    // (-50 + 100) / |-100| = 0.5
    expect(variancePoint(buildChart(), "B").value).toBeCloseTo(0.5);
  });

  it("has no value for a reference of 0", () => {
    expect(variancePoint(buildChart(), "A").value).toBeUndefined();
  });

  it("keeps a reference of 0 out of the scaling", () => {
    const chart = internals(buildChart());

    expect(chart.highestVarianceDataPointValue.value).toBeCloseTo(0.5);
    expect(Number.isFinite(chart.smallestVarianceDataPointValue.value)).toBe(true);
  });

  it("prints n/a and draws no pin for a reference of 0", () => {
    const chart = buildChart();
    const needleLayer = fakeGroup();
    const labelLayer = fakeGroup();

    // built like ScenarioFactory.createRelativeVarianceBar
    new Needle(internals(chart).position, internals(chart).styles, variancePoint(chart, "A"), 0, needleLayer.node as G)
      .updateLabelGroup(labelLayer.node as G)
      .draw();

    // the first group the needle asks for holds the pin
    const [pin] = needleLayer.groups;
    expect(labelLayer.calls).toContainEqual(["text", ["n/a"]]);
    expect(callNames(pin)).not.toContain("rect");
    expect(callNames(pin)).not.toContain("polygon");
  });
});
