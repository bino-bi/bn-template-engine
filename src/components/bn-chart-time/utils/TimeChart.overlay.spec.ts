import { Svg } from "@svgdotjs/svg.js";
import { TimeChart, tranformToAvgDataModel, tranformToMedianDataModel } from "./TimeChart";
import { buildTimeChart, timeRow } from "../../../utils/testing/timeChart";

type Model = Parameters<typeof tranformToAvgDataModel>[0];

const month = (index: number): string => `2024-${String(index).padStart(2, "0")}-01`;

const AC = [80, 90, 100, 100, 100, 100, 110, 120];

// AC from January to August, no row at all for September, forecast only from October to December
const acFcChart = (): TimeChart =>
  buildTimeChart(
    [
      ...AC.map((ac1, index) => timeRow(month(index + 1), { ac1 })),
      ...[10, 11, 12].map((index) => timeRow(month(index), { fc1: 130 })),
    ],
    { scenarios: ["ac1", "fc1"], dateInterval: "month" },
  );

const model = (chart: TimeChart): Model => (chart as unknown as { dataModel: Model }).dataModel;

const overlayValue = (overlay: Model): number | null | undefined => overlay[1].scenario1.value;

describe("TimeChart: average and median overlay", () => {
  it("has AC as the overlay scenario and four of twelve months without AC", () => {
    const dataModel = model(acFcChart());

    expect(dataModel).toHaveLength(12);
    expect(dataModel[0].scenario1.scenario).toBe("ac1");
    expect(dataModel.filter((entry) => !Number.isFinite(entry.scenario1.value))).toHaveLength(4);
  });

  it("averages only the months that have AC", () => {
    expect(overlayValue(tranformToAvgDataModel(model(acFcChart())))).toBe(100);
  });

  it("takes the median only of the months that have AC", () => {
    expect(overlayValue(tranformToMedianDataModel(model(acFcChart())))).toBe(100);
  });

  it("leaves a month without any row out of the median", () => {
    const chart = buildTimeChart(
      [timeRow(month(1), { ac1: 90 }), timeRow(month(2), { ac1: 100 }), timeRow(month(4), { ac1: 110 })],
      { scenarios: ["ac1"], dateInterval: "month" },
    );

    expect(model(chart)).toHaveLength(4);
    expect(overlayValue(tranformToMedianDataModel(model(chart)))).toBe(100);
    expect(overlayValue(tranformToAvgDataModel(model(chart)))).toBe(100);
  });

  it("has no overlay value when no month has AC", () => {
    const chart = buildTimeChart(
      [1, 2, 3].map((index) => timeRow(month(index), { fc1: 130 })),
      { scenarios: ["ac1", "fc1"], dateInterval: "month" },
    );

    expect(overlayValue(tranformToAvgDataModel(model(chart)))).toBeNaN();
    expect(overlayValue(tranformToMedianDataModel(model(chart)))).toBeNaN();
  });
});

describe("TimeChart: overlay of a chart without periods", () => {
  // layout() needs getBBox, which mock-doc lacks: the overlay layer is drawn directly
  const drawOverlay = (chart: TimeChart) =>
    (chart as unknown as { drawOverlayLayer(dataModel: Model, svg: Svg): void }).drawOverlayLayer(
      model(chart),
      new Svg(),
    );

  it.each(["showOverlayAvg", "showOverlayMedian"])("draws nothing for a chart with no rows (%s)", (overlay) => {
    const empty = buildTimeChart([], { scenarios: ["ac1"], dateInterval: "month", [overlay]: true });

    expect(model(empty)).toHaveLength(0);
    // the overlays read the first and the last period, and the average is on by default
    expect(() => drawOverlay(empty)).not.toThrow();
  });
});
