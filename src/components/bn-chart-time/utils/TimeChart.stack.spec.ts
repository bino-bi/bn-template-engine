// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
// mock-doc cannot measure text: every character is 6 px wide here, so the axis has a real position.
jest.mock("calculate-size", () => ({
  __esModule: true,
  default: (text: string) => ({ width: text.length * 6, height: 12 }),
}));

import { Svg } from "@svgdotjs/svg.js";
import { TimeChart } from "./TimeChart";
import { ElementPositions } from "./helper";
import { StackBy, StackMode, StackOrder } from "../../../utils/constants";
import { FakeGroup, fakeGroup } from "../../../utils/testing/fakeGroup";
import { buildTimeChart, timeRow } from "../../../utils/testing/timeChart";

const PPU = 2;

// January: positive side 16, negative side 4, total 12. February: 4, 9 and -5.
const MIXED = [timeRow("2024-01-01", { ac1: 10, ac2: -4, ac3: 6 }), timeRow("2024-02-01", { ac1: 3, ac2: -9, ac3: 1 })];

const stackChart = (
  rows: Record<string, unknown>[],
  mode: StackMode = StackMode.ABSOLUTE,
  config: Record<string, unknown> = {},
): TimeChart =>
  buildTimeChart(rows, {
    scenarios: ["ac1", "ac2", "ac3"],
    dateInterval: "month",
    pixelPerUnit: PPU,
    stackConfig: { by: StackBy.SCENARIOS, mode, order: StackOrder.DATASET },
    ...config,
  });

interface ChartInternals {
  dataModel: unknown[];
  position: ElementPositions;
  highestDataPointValue: { value: number };
  smallestDataPointValue: { value: number };
  drawStackedScenarios(dataModel: unknown[], svgContainer: Svg): void;
  drawStackedAreaScenarios(dataModel: unknown[], svgContainer: Svg): void;
  drawAxisAndLabels(dataModel: unknown[], svgContainer: Svg): void;
}

const internals = (chart: TimeChart): ChartInternals => chart as unknown as ChartInternals;

const call = (group: FakeGroup, name: string): unknown[] | undefined =>
  group.calls.find(([callName]) => callName === name)?.[1];

/** The groups below the layer that a draw method creates. */
const drawn = (
  chart: TimeChart,
  method: "drawStackedScenarios" | "drawStackedAreaScenarios" | "drawAxisAndLabels",
): FakeGroup[] => {
  const container = fakeGroup();
  internals(chart)[method](internals(chart).dataModel, container.node as Svg);
  return container.groups[0].groups;
};

/** Height and y of one segment rect. */
const segment = (groups: FakeGroup[], column: number, index: number): [number, number] => {
  const group = groups.find((entry) => call(entry, "id")?.[0] === `stacked_col_${column}_seg_${index}`)!;
  return [call(group, "rect")![1] as number, call(group, "y")![0] as number];
};

/** First y position of the label with the given text. */
const labelY = (groups: FakeGroup[], text: string): number => {
  const group = groups.find((entry) => call(entry, "text")?.[0] === text)!;
  return call(group, "move")![1] as number;
};

describe("time chart stack with negative segments", () => {
  it("draws positive segments above the axis and negative segments below it", () => {
    const chart = stackChart(MIXED);
    const axisY = internals(chart).position.getColumnPositionY();
    const groups = drawn(chart, "drawStackedScenarios");

    expect(Number.isFinite(axisY)).toBe(true);
    expect(segment(groups, 0, 0)).toEqual([20, axisY - 20]);
    expect(segment(groups, 0, 1)).toEqual([8, axisY]);
    expect(segment(groups, 0, 2)).toEqual([12, axisY - 32]);

    expect(segment(groups, 1, 0)).toEqual([6, axisY - 6]);
    expect(segment(groups, 1, 1)).toEqual([18, axisY]);
    expect(segment(groups, 1, 2)).toEqual([2, axisY - 8]);
  });

  it("prints the signed total above the positive side or below the negative side", () => {
    const chart = stackChart(MIXED);
    const position = internals(chart).position;
    const axisY = position.getColumnPositionY();
    const groups = drawn(chart, "drawStackedScenarios");

    expect(labelY(groups, "12,0")).toBe(axisY - 32 - position.spacings.labelToColumn);
    expect(labelY(groups, "-5,0")).toBe(axisY + 18 + position.spacings.labelToColumn);
  });

  it("lays the chart out for the sides of the stacks, not for the largest segment", () => {
    const chart = stackChart(MIXED);

    expect(internals(chart).highestDataPointValue.value).toBe(16);
    expect(internals(chart).smallestDataPointValue.value).toBe(-9);
    expect(chart.getUnitBarExtent()).toBe(25);
  });

  it("gives a stack of positive values the height of its total", () => {
    const chart = stackChart([timeRow("2024-01-01", { ac1: 10, ac2: 8 })]);
    const axisY = internals(chart).position.getColumnPositionY();
    const groups = drawn(chart, "drawStackedScenarios");

    expect(internals(chart).highestDataPointValue.value).toBe(18);
    expect(internals(chart).smallestDataPointValue.value).toBe(0);
    expect(segment(groups, 0, 0)).toEqual([20, axisY - 20]);
    expect(segment(groups, 0, 1)).toEqual([16, axisY - 36]);
    expect(labelY(groups, "18,0")).toBe(axisY - 36 - internals(chart).position.spacings.labelToColumn);
  });

  it("puts the date label behind the segments on the side opposite the total", () => {
    const chart = stackChart(MIXED, StackMode.ABSOLUTE, { axisLabelsMode: "short", locale: "en" });
    const position = internals(chart).position;
    const axisY = position.getAxisPositionY(false);
    const groups = drawn(chart, "drawAxisAndLabels");

    // January has a total of 12: label below its 4 negative units. February has -5: label above its 4 positive units.
    expect(labelY(groups, "Jan")).toBe(axisY + position.spacings.labelToAxis + 8);
    expect(labelY(groups, "Feb")).toBe(axisY - position.spacings.labelToAxis - 8);
  });

  it("splits a 100 % stack around the axis and keeps its height", () => {
    const chart = stackChart(MIXED, StackMode.RELATIVE);
    const axisY = internals(chart).position.getColumnPositionY();
    const groups = drawn(chart, "drawStackedScenarios");
    const closeTo = (values: number[]): unknown[] => values.map((value) => expect.closeTo(value, 9));

    // shares of the sum of absolute values (20): 50 %, -20 %, 30 %, with 2 px per percent point
    expect(segment(groups, 0, 0)).toEqual(closeTo([100, axisY - 100]));
    expect(segment(groups, 0, 1)).toEqual(closeTo([40, axisY]));
    expect(segment(groups, 0, 2)).toEqual(closeTo([60, axisY - 160]));
    // January needs 80 % above the axis, February 9 of 13 below it
    expect(chart.getUnitBarExtent()).toBeCloseTo(80 + 900 / 13);
  });

  it("draws nothing for a scenario family without a value in a period", () => {
    // February has a forecast only: its AC stack was a hairline labelled 0,0
    const chart = buildTimeChart([timeRow("2024-01-01", { ac1: 100 }), timeRow("2024-02-01", { fc1: 50 })], {
      scenarios: ["ac1", "fc1"],
      dateInterval: "month",
      pixelPerUnit: PPU,
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const groups = drawn(chart, "drawStackedScenarios");
    const texts = groups.map((group) => call(group, "text")?.[0]).filter((text) => text !== undefined);
    /** Fill colours of the rects drawn for one period. */
    const fills = (index: number): unknown[] =>
      groups
        .filter((group) => String(call(group, "id")?.[0]).startsWith(`stacked_col_${index}_`))
        .filter((group) => call(group, "rect") !== undefined)
        .map((group) => (call(group, "fill")![0] as { color: string }).color);

    // one rect per period, and each family keeps its colour: AC in front is black, FC behind it light grey
    expect(fills(0)).toEqual(["#000000"]);
    expect(fills(1)).toEqual(["#c0c0c0"]);
    expect(texts).not.toContain("0,0");
    expect(texts).not.toContain("NaN");
  });

  it("names a scenario family in the header that has no value in the first period", () => {
    const chart = buildTimeChart([timeRow("2024-01-01", { ac1: 100 }), timeRow("2024-02-01", { fc1: 50 })], {
      scenarios: ["ac1", "fc1"],
      dateInterval: "month",
      pixelPerUnit: PPU,
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const container = fakeGroup();
    (internals(chart) as unknown as { drawStackedHeaders(model: unknown[], svg: Svg): void }).drawStackedHeaders(
      internals(chart).dataModel,
      container.node as Svg,
    );
    const headers = container.groups[0].groups.map((group) => call(group, "text")?.[0]);

    expect(headers).toEqual(["FC", "AC"]);
  });

  it("puts the date label below when a total label of a back stack is above the columns", () => {
    // AC -40 in front (total below), PL 60 behind it (total above). Above the columns there is room for one label only.
    const chart = buildTimeChart([timeRow("2024-01-01", { ac1: -40, pl1: 60 })], {
      scenarios: ["ac1", "pl1"],
      dateInterval: "month",
      pixelPerUnit: PPU,
      axisLabelsMode: "short",
      locale: "en",
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const position = internals(chart).position;
    const dateY = labelY(drawn(chart, "drawAxisAndLabels"), "Jan");

    // below the 40 negative units and the total label of AC
    expect(dateY).toBe(
      position.getAxisPositionY(false) +
        position.spacings.labelToAxis +
        80 +
        position.spacings.labelToColumn +
        position.dataLabelHeight,
    );
  });

  it("keeps the date label clear of the total label of a back stack", () => {
    // AC 10 in front, PL -5 behind it: the total -5,0 hangs below the PL column, where the date label goes
    const chart = buildTimeChart([timeRow("2024-01-01", { ac1: 10, pl1: -5 })], {
      scenarios: ["ac1", "pl1"],
      dateInterval: "month",
      pixelPerUnit: PPU,
      axisLabelsMode: "short",
      locale: "en",
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order: StackOrder.DATASET },
    });
    const position = internals(chart).position;
    const totalY = labelY(drawn(chart, "drawStackedScenarios"), "-5,0");
    const dateY = labelY(drawn(chart, "drawAxisAndLabels"), "Jan");

    expect(totalY).toBe(position.getColumnPositionY() + 10 + position.spacings.labelToColumn);
    expect(dateY).toBeGreaterThanOrEqual(totalY + position.dataLabelHeight);
  });

  it("keeps an area layer on its side of the axis in a period where it has no value", () => {
    // ac2 is negative in January and March and has no value in February
    const chart = stackChart(
      [
        timeRow("2024-01-01", { ac1: -3, ac2: -4, ac3: -5 }),
        timeRow("2024-02-01", { ac1: -3, ac3: -5 }),
        timeRow("2024-03-01", { ac1: -3, ac2: -4, ac3: -5 }),
      ],
      StackMode.ABSOLUTE,
      { chartMode: "line" },
    );
    const axisY = internals(chart).position.getColumnPositionY();
    const x = (index: number): number => internals(chart).position.getColumnCenterPositionX(index);
    const group = drawn(chart, "drawStackedAreaScenarios").find((entry) => call(entry, "id")?.[0] === "area_fill_1")!;

    // from 7 to 3 units below the axis, closed at 3 units below it in February (it jumped up to the axis)
    expect(call(group, "path")![0]).toBe(
      `M ${x(0)},${axisY + 14} L ${x(1)},${axisY + 6} L ${x(2)},${axisY + 14} ` +
        `L ${x(2)},${axisY + 6} L ${x(1)},${axisY + 6} L ${x(0)},${axisY + 6} Z`,
    );
  });

  it.each([
    [StackOrder.ASC, [10, 30]],
    [StackOrder.DESC, [30, 10]],
  ])("sorts a stack %s that has a scenario without a value", (order, expected) => {
    // ac2 has no value: its place in the comparison was NaN and the stack stayed unsorted
    const chart = buildTimeChart([timeRow("2024-01-01", { ac1: 30, ac3: 10 })], {
      scenarios: ["ac1", "ac2", "ac3"],
      dateInterval: "month",
      pixelPerUnit: PPU,
      stackConfig: { by: StackBy.SCENARIOS, mode: StackMode.ABSOLUTE, order },
    });
    const heights = drawn(chart, "drawStackedScenarios")
      .filter((group) => String(call(group, "id")?.[0]).startsWith("stacked_col_") && call(group, "rect") !== undefined)
      .map((group) => (call(group, "rect")![1] as number) / PPU);

    expect(heights).toEqual(expected);
  });

  it("stacks the area of line mode on both sides like the columns", () => {
    const chart = stackChart(MIXED, StackMode.ABSOLUTE, { chartMode: "line" });
    const axisY = internals(chart).position.getColumnPositionY();
    const areaPath = (layer: number): string => {
      const group = drawn(chart, "drawStackedAreaScenarios").find(
        (entry) => call(entry, "id")?.[0] === `area_fill_${layer}`,
      )!;
      return call(group, "path")![0] as string;
    };
    const x = (index: number): number => internals(chart).position.getColumnCenterPositionX(index);

    expect(internals(chart).highestDataPointValue.value).toBe(16);
    expect(internals(chart).smallestDataPointValue.value).toBe(-9);
    // ac1 from the axis up to 10 and 3 units
    expect(areaPath(0)).toBe(`M ${x(0)},${axisY - 20} L ${x(1)},${axisY - 6} L ${x(1)},${axisY} L ${x(0)},${axisY} Z`);
    // ac2 from the axis down to 4 and 9 units
    expect(areaPath(1)).toBe(`M ${x(0)},${axisY + 8} L ${x(1)},${axisY + 18} L ${x(1)},${axisY} L ${x(0)},${axisY} Z`);
    // ac3 on top of ac1
    expect(areaPath(2)).toBe(
      `M ${x(0)},${axisY - 32} L ${x(1)},${axisY - 8} L ${x(1)},${axisY - 6} L ${x(0)},${axisY - 20} Z`,
    );
  });
});
