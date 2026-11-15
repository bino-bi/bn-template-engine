// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
// mock-doc cannot measure text: every character is 6 px wide here, so the axis has a real position.
jest.mock("calculate-size", () => ({
  __esModule: true,
  default: (text: string) => ({ width: text.length * 6, height: 12 }),
}));

import { Box, G, Svg } from "@svgdotjs/svg.js";
import { TimeChart } from "./TimeChart";
import { StackBy, StackMode, StackOrder } from "../../../utils/constants";
import { buildTimeChart, timeRow } from "../../../utils/testing/timeChart";

// November to February: the year change draws the dashed separator line
const ROWS = [
  timeRow("2024-11-01", { ac1: 10, pp1: 8, fc1: 12, pl1: 11 }),
  timeRow("2024-12-01", { ac1: 14, pp1: 9, fc1: 13, pl1: 12 }),
  timeRow("2025-01-01", { ac1: 9, pp1: 11, fc1: 15, pl1: 13 }),
  timeRow("2025-02-01", { ac1: 16, pp1: 12, fc1: 14, pl1: 15 }),
];

type DrawMethod = "drawLineScenarios" | "drawStackedAreaScenarios" | "drawAxisAndLabelsForLineChart";

const lineChart = (config: Record<string, unknown> = {}): TimeChart =>
  buildTimeChart(ROWS, {
    scenarios: ["ac1", "pp1", "fc1", "pl1"],
    dateInterval: "month",
    pixelPerUnit: 2,
    chartMode: "line",
    ...config,
  });

/** The SVG markup one draw method of the chart writes. */
const drawn = (chart: TimeChart, method: DrawMethod): string => {
  const internals = chart as unknown as Record<DrawMethod, (dataModel: unknown[], svg: Svg) => void> & {
    dataModel: unknown[];
  };
  const svg = new Svg();
  internals[method](internals.dataModel, svg);
  return svg.svg();
};

// mock-doc cannot measure: the draw methods read the box of their group after they have drawn
beforeAll(() => {
  jest.spyOn(G.prototype, "bbox").mockReturnValue(new Box());
});

afterAll(() => {
  jest.restoreAllMocks();
});

// The snapshots were written before the scenario looks moved to utils/notation.ts.
describe("time chart: line, marker and area looks of ac, pp, fc and pl", () => {
  it("draws the same lines and markers", () => {
    expect(drawn(lineChart(), "drawLineScenarios")).toMatchSnapshot();
  });

  it("draws the same areas and boundary lines", () => {
    const stackConfig = { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET };

    expect(drawn(lineChart({ stackConfig }), "drawStackedAreaScenarios")).toMatchSnapshot();
  });

  it("draws the same year separator", () => {
    expect(drawn(lineChart(), "drawAxisAndLabelsForLineChart")).toMatchSnapshot();
  });
});
