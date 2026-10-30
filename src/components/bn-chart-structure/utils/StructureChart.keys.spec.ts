// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
jest.mock("calculate-size", () => ({
  __esModule: true,
  default: (text: string) => ({ width: text.length * 6, height: 12 }),
}));

import { Svg } from "@svgdotjs/svg.js";
import { StructureChart } from "./StructureChart";
import { AggregationLevel, StackBy, StackMode, StackOrder } from "../../../utils/constants";
import { FakeGroup, fakeGroup } from "../../../utils/testing/fakeGroup";
import { buildStructureChart, structureRow } from "../../../utils/testing/structureChart";

interface ChartInternals {
  dataModel: unknown[];
  variancesDataModel: unknown[];
  drawScenarios(dataModel: unknown[], svgContainer: Svg): void;
  drawStackedScenarios(dataModel: unknown[], svgContainer: Svg): void;
  drawVarianceScenario(dataModel: unknown[], svgContainer: Svg): void;
}

const keysBelow = (group: FakeGroup): Record<string, string>[] => [
  ...group.calls
    .filter(([name, args]) => name === "attr" && typeof args[0] === "object")
    .map(([, args]) => args[0] as Record<string, string>)
    .filter((attributes) => Object.keys(attributes).some((name) => name.startsWith("data-bn-"))),
  ...group.groups.flatMap(keysBelow),
];

const keyed = (chart: StructureChart, draw: (internals: ChartInternals, svg: Svg) => void) => {
  const container = fakeGroup();
  draw(chart as unknown as ChartInternals, container.node as Svg);
  return keysBelow(container);
};

const ROWS = [
  { ...structureRow("Hardware", 1, { ac1: 10, pl1: 8 }), rowGroup: "Europe", rowGroupIndex: 1, subCategory: "X" },
  { ...structureRow("Software", 2, { ac1: 3, pl1: 2 }), rowGroup: "Europe", rowGroupIndex: 1, subCategory: "Y" },
];

describe("structure chart data-point keys", () => {
  it("keys bars with the raw value of the level and the scenario slot", () => {
    const chart = buildStructureChart(ROWS, {
      scenarios: ["ac1", "pl1"],
      level: AggregationLevel.CATEGORY,
      pixelPerUnit: 2,
    });
    const keys = keyed(chart, (internals, svg) => internals.drawScenarios(internals.dataModel, svg));

    expect(keys).toContainEqual({
      "data-bn-category": "Software",
      "data-bn-scenario": "ac1",
      "data-bn-part": "element",
    });
  });

  it("names the dimension of the level", () => {
    const chart = buildStructureChart(ROWS, {
      scenarios: ["ac1"],
      level: AggregationLevel.ROWGROUP,
      pixelPerUnit: 2,
    });
    const keys = keyed(chart, (internals, svg) => internals.drawScenarios(internals.dataModel, svg));

    expect(keys).toContainEqual({
      "data-bn-row-group": "Europe",
      "data-bn-scenario": "ac1",
      "data-bn-part": "element",
    });
  });

  it("keys a dimension stack with the bar and the segment, and the total with the bar only", () => {
    const chart = buildStructureChart(ROWS, {
      scenarios: ["ac1"],
      level: AggregationLevel.ROWGROUP,
      pixelPerUnit: 2,
      stackConfig: { by: StackBy.DIMENSIONS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const keys = keyed(chart, (internals, svg) => internals.drawStackedScenarios(internals.dataModel, svg));

    expect(keys).toEqual(
      expect.arrayContaining([
        {
          "data-bn-row-group": "Europe",
          "data-bn-category": "Software",
          "data-bn-scenario": "ac1",
          "data-bn-part": "element",
        },
        { "data-bn-row-group": "Europe", "data-bn-part": "total" },
      ]),
    );
  });

  it("keys variance bars with the name of the variance", () => {
    const chart = buildStructureChart(ROWS, {
      scenarios: ["ac1", "pl1"],
      variances: ["dac1_pl1_pos"],
      level: AggregationLevel.CATEGORY,
      pixelPerUnit: 2,
    });
    const keys = keyed(chart, (internals, svg) => internals.drawVarianceScenario(internals.variancesDataModel, svg));

    expect(keys).toContainEqual({
      "data-bn-category": "Hardware",
      "data-bn-scenario": "dac1_pl1_pos",
      "data-bn-part": "element",
    });
  });
});
