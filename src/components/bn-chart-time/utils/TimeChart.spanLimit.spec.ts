import { DateTime } from "luxon";
import { TimeChart } from "./TimeChart";
import { ChartMode } from "../../../utils/constants";
import { buildTimeChart, timeRow } from "../../../utils/testing/timeChart";

const monthlyRows = (count: number): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, index) =>
    timeRow(DateTime.utc(2022, 1, 1).plus({ months: index }).toISODate() as string, { ac1: 100 + index }),
  );

interface ChartInternals {
  dataModel: { date: DateTime; scenario1: { value: number | null } }[];
  determineEffectiveChartMode(): ChartMode;
}

const internals = (chart: TimeChart): ChartInternals => chart as unknown as ChartInternals;

const monthChart = (config: Record<string, unknown> = {}): TimeChart =>
  buildTimeChart(monthlyRows(36), { scenarios: ["ac1"], dateInterval: "month", ...config });

describe("TimeChart: interval span limit", () => {
  it("keeps all 36 months of a three year series, the newest included", () => {
    const model = internals(monthChart()).dataModel;

    expect(model).toHaveLength(36);
    expect(model[35].date.toISODate()).toBe("2024-12-01");
    expect(model[35].scenario1.value).toBe(135);
  });

  it("does not collapse the series for a limit of 0", () => {
    expect(internals(monthChart({ intervalSpanLimit: 0 })).dataModel).toHaveLength(36);
  });

  it("switches chart-mode auto to line when the periods exceed max-bars", () => {
    expect(internals(monthChart({ chartMode: "auto", maxBars: 28 })).determineEffectiveChartMode()).toBe(
      ChartMode.LINE,
    );
    expect(internals(monthChart({ chartMode: "auto", maxBars: 36 })).determineEffectiveChartMode()).toBe(ChartMode.BAR);
  });

  it("adds no gap periods when the interval is far finer than the data", () => {
    const chart = buildTimeChart(
      [timeRow("2024-01-01T00:00:00Z", { ac1: 1 }), timeRow("2024-01-02T00:00:00Z", { ac1: 2 })],
      { scenarios: ["ac1"], dateInterval: "second" },
    );

    expect(internals(chart).dataModel.map((entry) => entry.scenario1.value)).toEqual([1, 2]);
  });
});
