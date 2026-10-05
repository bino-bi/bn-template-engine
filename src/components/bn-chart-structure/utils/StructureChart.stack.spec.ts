// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
// mock-doc cannot measure text: every character is 6 px wide here, so the axis has a real position.
jest.mock("calculate-size", () => ({
  __esModule: true,
  default: (text: string) => ({ width: text.length * 6, height: 12 }),
}));

import { Svg } from "@svgdotjs/svg.js";
import { StructureChart } from "./StructureChart";
import { ElementPositions } from "./helper";
import { StackBy, StackMode, StackOrder } from "../../../utils/constants";
import { FakeGroup, fakeGroup } from "../../../utils/testing/fakeGroup";
import { buildStructureChart, structureRow } from "../../../utils/testing/structureChart";

const PPU = 10;

// row A: positive side 16, negative side 4, total 12. Row B: 4, 9 and -5.
const MIXED = [structureRow("A", 1, { ac1: 10, ac2: -4, ac3: 6 }), structureRow("B", 2, { ac1: 3, ac2: -9, ac3: 1 })];

const stackChart = (rows: Record<string, unknown>[], mode: StackMode = StackMode.ABSOLUTE): StructureChart =>
  buildStructureChart(rows, {
    scenarios: ["ac1", "ac2", "ac3"],
    pixelPerUnit: PPU,
    stackConfig: { by: StackBy.SCENARIOS, mode, order: StackOrder.DATASET },
  });

interface ChartInternals {
  dataModel: unknown[];
  position: ElementPositions;
  drawStackedScenarios(dataModel: unknown[], svgContainer: Svg): void;
  drawAxisAndLabels(dataModel: unknown[], svgContainer: Svg, stacked?: boolean): void;
  calculateLeftSideWidth(varianceType: string): number;
}

const internals = (chart: StructureChart): ChartInternals => chart as unknown as ChartInternals;

const call = (group: FakeGroup, name: string): unknown[] | undefined =>
  group.calls.find(([callName]) => callName === name)?.[1];

/** The groups below the layer that a draw method creates. */
const drawn = (chart: StructureChart, method: "drawStackedScenarios" | "drawAxisAndLabels"): FakeGroup[] => {
  const container = fakeGroup();
  internals(chart)[method](internals(chart).dataModel, container.node as Svg, true);
  return container.groups[0].groups;
};

/** Width and x of one segment rect. */
const segment = (groups: FakeGroup[], row: number, index: number): [number, number] => {
  const group = groups.find((entry) => call(entry, "id")?.[0] === `stacked_bar_${row}_seg_${index}`)!;
  return [call(group, "rect")![0] as number, call(group, "x")![0] as number];
};

/** First position and anchor of the label with the given text. */
const label = (groups: FakeGroup[], text: string): { x: number; anchor: string } => {
  const group = groups.find((entry) => call(entry, "text")?.[0] === text)!;
  return {
    x: call(group, "move")![0] as number,
    anchor: (call(group, "font")![0] as { anchor: string }).anchor,
  };
};

describe("structure chart stack with negative segments", () => {
  it("draws positive segments right of the axis and negative segments left of it", () => {
    const chart = stackChart(MIXED);
    const axisX = internals(chart).position.getBarPositionX();
    expect(Number.isFinite(axisX)).toBe(true);
    const groups = drawn(chart, "drawStackedScenarios");

    expect(segment(groups, 0, 0)).toEqual([100, axisX]);
    expect(segment(groups, 0, 1)).toEqual([40, axisX - 40]);
    expect(segment(groups, 0, 2)).toEqual([60, axisX + 100]);

    expect(segment(groups, 1, 0)).toEqual([30, axisX]);
    expect(segment(groups, 1, 1)).toEqual([90, axisX - 90]);
    expect(segment(groups, 1, 2)).toEqual([10, axisX + 30]);
  });

  it("prints the signed total at the end of the side the total is on", () => {
    const chart = stackChart(MIXED);
    const position = internals(chart).position;
    const axisX = position.getBarPositionX();
    const groups = drawn(chart, "drawStackedScenarios");

    expect(label(groups, "12,0")).toEqual({ x: axisX + 160 + position.spacings.labelToBar, anchor: "start" });
    expect(label(groups, "-5,0")).toEqual({ x: axisX - 90 - position.spacings.labelToBar, anchor: "end" });
  });

  it("scales for both sides of the axis", () => {
    // 16 units right of the axis and 9 left of it
    expect(stackChart(MIXED).getUnitBarExtent()).toBe(25);
  });

  it("reserves the room left of the axis for the negative side and the label of a negative total", () => {
    const chart = stackChart(MIXED);
    const labelToBar = internals(chart).position.spacings.labelToBar;

    // 9 units of row B, then the gap and the four characters of "-5,0"
    expect(internals(chart).calculateLeftSideWidth("")).toBeCloseTo(90 + labelToBar + 24);
  });

  it("puts the category label behind the segments on the side opposite the total", () => {
    const chart = stackChart(MIXED);
    const position = internals(chart).position;
    const groups = drawn(chart, "drawAxisAndLabels");

    // A has a total of 12: label left of its 4 negative units. B has -5: label right of its 4 positive units.
    expect(label(groups, "A")).toEqual({ x: position.getCategoryPositionX(true) - 40, anchor: "end" });
    expect(label(groups, "B")).toEqual({ x: position.getCategoryPositionX(false) + 40, anchor: "start" });
  });

  it("splits a 100 % stack around the axis and keeps its length", () => {
    const chart = stackChart(MIXED, StackMode.RELATIVE);
    const axisX = internals(chart).position.getBarPositionX();
    const groups = drawn(chart, "drawStackedScenarios");

    // shares of the sum of absolute values (20): 50 %, -20 %, 30 %, with 10 px for the whole stack
    const closeTo = (values: number[]): unknown[] => values.map((value) => expect.closeTo(value, 9));

    expect(segment(groups, 0, 0)).toEqual(closeTo([5, axisX]));
    expect(segment(groups, 0, 1)).toEqual(closeTo([2, axisX - 2]));
    expect(segment(groups, 0, 2)).toEqual(closeTo([3, axisX + 5]));
    // row A needs 80 % of the length right of the axis, row B 9 of 13 left of it
    expect(chart.getUnitBarExtent()).toBeCloseTo(0.8 + 9 / 13);
  });

  it("draws nothing for a scenario family without a value in a row", () => {
    // row B has a forecast only: its AC stack was a hairline labelled 0,0
    const chart = buildStructureChart([structureRow("A", 1, { ac1: 100 }), structureRow("B", 2, { fc1: 50 })], {
      scenarios: ["ac1", "fc1"],
      pixelPerUnit: PPU,
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const groups = drawn(chart, "drawStackedScenarios");
    const texts = groups.map((group) => call(group, "text")?.[0]).filter((text) => text !== undefined);
    /** Fill colours of the rects drawn for one row. */
    const fills = (row: number): unknown[] =>
      groups
        .filter((group) => String(call(group, "id")?.[0]).startsWith(`stacked_bar_${row}_`))
        .filter((group) => call(group, "rect") !== undefined)
        .map((group) => (call(group, "fill")![0] as { color: string }).color);

    // one rect per row, and each family keeps its colour: AC in front is black, FC behind it light grey
    expect(fills(0)).toEqual(["#000000"]);
    expect(fills(1)).toEqual(["#c0c0c0"]);
    expect(texts).not.toContain("0,0");
    expect(texts).not.toContain("NaN");
  });

  it("keeps the category label clear of the total label of a back stack", () => {
    // AC 10 in front, PL -5 behind it: the total -5,0 is printed left of the PL bar, where the category label goes
    const chart = buildStructureChart([structureRow("Germany", 1, { ac1: 10, pl1: -5 })], {
      scenarios: ["ac1", "pl1"],
      pixelPerUnit: PPU,
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const position = internals(chart).position;
    // the segment prints -5,0 as well, the total label is drawn after it
    const stackLabels = drawn(chart, "drawStackedScenarios").filter((group) => call(group, "text")?.[0] === "-5,0");
    const total = label([stackLabels[stackLabels.length - 1]], "-5,0");
    const category = label(drawn(chart, "drawAxisAndLabels"), "Germany");

    expect(stackLabels).toHaveLength(2);

    expect(total.x).toBe(position.getBarPositionX() - 50 - position.spacings.labelToBar);
    // the label is printed as "-5,0": four characters of 6 px in this spec
    expect(category.x).toBeLessThanOrEqual(total.x - 24);
  });

  it.each([
    [StackOrder.ASC, [10, 30]],
    [StackOrder.DESC, [30, 10]],
  ])("sorts a stack %s that has a scenario without a value", (order, expected) => {
    // ac2 has no value: its place in the comparison was NaN and the stack stayed unsorted
    const chart = buildStructureChart([structureRow("A", 1, { ac1: 30, ac3: 10 })], {
      scenarios: ["ac1", "ac2", "ac3"],
      pixelPerUnit: PPU,
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order },
    });
    const widths = drawn(chart, "drawStackedScenarios")
      .filter((group) => String(call(group, "id")?.[0]).startsWith("stacked_bar_") && call(group, "rect") !== undefined)
      .map((group) => (call(group, "rect")![0] as number) / PPU);

    expect(widths).toEqual(expected);
  });

  it("draws a stack of positive values as before", () => {
    const chart = stackChart([structureRow("A", 1, { ac1: 10, ac2: 4, ac3: 6 })]);
    const position = internals(chart).position;
    const axisX = position.getBarPositionX();
    const groups = drawn(chart, "drawStackedScenarios");

    expect(segment(groups, 0, 0)).toEqual([100, axisX]);
    expect(segment(groups, 0, 1)).toEqual([40, axisX + 100]);
    expect(segment(groups, 0, 2)).toEqual([60, axisX + 140]);
    expect(label(groups, "20,0")).toEqual({ x: axisX + 200 + position.spacings.labelToBar, anchor: "start" });
    expect(chart.getUnitBarExtent()).toBe(20);
  });
});
