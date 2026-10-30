// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
jest.mock("calculate-size", () => ({
  __esModule: true,
  default: (text: string) => ({ width: text.length * 6, height: 12 }),
}));

import { Svg } from "@svgdotjs/svg.js";
import { TimeChart } from "./TimeChart";
import { StackBy, StackMode, StackOrder } from "../../../utils/constants";
import { FakeGroup, fakeGroup } from "../../../utils/testing/fakeGroup";
import { buildTimeChart, timeRow } from "../../../utils/testing/timeChart";

interface ChartInternals {
  dataModel: unknown[];
  variancesDataModel: unknown[];
  drawScenarios(dataModel: unknown[], svgContainer: Svg): void;
  drawStackedScenarios(dataModel: unknown[], svgContainer: Svg): void;
  drawVarianceScenario(dataModel: unknown[], svgContainer: Svg): void;
}

/** Every key written below a stand-in group, as written. */
const keysBelow = (group: FakeGroup): Record<string, string>[] => [
  ...group.calls
    .filter(([name, args]) => name === "attr" && typeof args[0] === "object")
    .map(([, args]) => args[0] as Record<string, string>)
    .filter((attributes) => Object.keys(attributes).some((name) => name.startsWith("data-bn-"))),
  ...group.groups.flatMap(keysBelow),
];

const keyed = (chart: TimeChart, draw: (internals: ChartInternals, svg: Svg) => void) => {
  const container = fakeGroup();
  draw(chart as unknown as ChartInternals, container.node as Svg);
  return keysBelow(container);
};

const ROWS = [timeRow("2024-01-15", { ac1: 10, ac2: 4, pl1: 8 }), timeRow("2024-03-20", { ac1: 3, ac2: 1, pl1: 2 })];

const element = (date: string, scenario: string) => ({
  "data-bn-date": date,
  "data-bn-scenario": scenario,
  "data-bn-part": "element",
});

describe("time chart data-point keys", () => {
  it("keys bars with the first day of their bucket and their scenario slot", () => {
    const chart = buildTimeChart(ROWS, { scenarios: ["ac1", "pl1"], dateInterval: "month", pixelPerUnit: 2 });
    const keys = keyed(chart, (internals, svg) => internals.drawScenarios(internals.dataModel, svg));

    expect(keys).toEqual(expect.arrayContaining([element("2024-01-01", "ac1"), element("2024-03-01", "pl1")]));
    // the group around a bar has the key, but it is not the data point
    expect(keys).toContainEqual({ "data-bn-date": "2024-01-01", "data-bn-scenario": "ac1" });
  });

  it("tells the buckets of an hourly chart apart", () => {
    const rows = [timeRow("2024-01-01T08:00:00Z", { ac1: 1 }), timeRow("2024-01-01T09:00:00Z", { ac1: 2 })];
    const chart = buildTimeChart(rows, { scenarios: ["ac1"], dateInterval: "hour", pixelPerUnit: 2 });
    const keys = keyed(chart, (internals, svg) => internals.drawScenarios(internals.dataModel, svg));

    expect(keys).toEqual(
      expect.arrayContaining([element("2024-01-01T08:00:00", "ac1"), element("2024-01-01T09:00:00", "ac1")]),
    );
  });

  it("does not key a bucket without a value", () => {
    const chart = buildTimeChart(ROWS, { scenarios: ["ac1"], dateInterval: "month", pixelPerUnit: 2 });
    const keys = keyed(chart, (internals, svg) => internals.drawScenarios(internals.dataModel, svg));

    // February is drawn as a gap
    expect(keys.some((key) => key["data-bn-date"] === "2024-02-01")).toBe(false);
  });

  it("keys stack segments with their scenario, and the total with the date only", () => {
    const chart = buildTimeChart(ROWS, {
      scenarios: ["ac1", "ac2"],
      dateInterval: "month",
      pixelPerUnit: 2,
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const keys = keyed(chart, (internals, svg) => internals.drawStackedScenarios(internals.dataModel, svg));

    expect(keys).toEqual(
      expect.arrayContaining([
        element("2024-01-01", "ac1"),
        element("2024-01-01", "ac2"),
        { "data-bn-date": "2024-01-01", "data-bn-part": "total" },
      ]),
    );
  });

  it("tells the totals of an overlay stack apart by the scenario family", () => {
    const chart = buildTimeChart(ROWS, {
      scenarios: ["ac1", "pl1"],
      dateInterval: "month",
      pixelPerUnit: 2,
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const keys = keyed(chart, (internals, svg) => internals.drawStackedScenarios(internals.dataModel, svg));

    expect(keys).toEqual(
      expect.arrayContaining([
        { "data-bn-date": "2024-01-01", "data-bn-scenario": "ac", "data-bn-part": "total" },
        { "data-bn-date": "2024-01-01", "data-bn-scenario": "pl", "data-bn-part": "total" },
      ]),
    );
  });

  it("keys variance bars with the name of the variance", () => {
    const chart = buildTimeChart(ROWS, {
      scenarios: ["ac1", "pl1"],
      variances: ["dac1_pl1_pos"],
      dateInterval: "month",
      pixelPerUnit: 2,
    });
    const keys = keyed(chart, (internals, svg) => internals.drawVarianceScenario(internals.variancesDataModel, svg));

    expect(keys).toContainEqual(element("2024-01-01", "dac1_pl1_pos"));
  });
});
