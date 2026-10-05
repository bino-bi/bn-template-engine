import { TimeChart } from "./TimeChart";
import { buildTimeChart, timeRow } from "../../../utils/testing/timeChart";

interface ChartInternals {
  dataModel: unknown[];
  isYearChange(dataModel: unknown[], index: number): boolean;
}

// Mondays of ISO week 52 of 2024 and of the weeks 1 and 2 of 2025
const chart = (): TimeChart =>
  buildTimeChart(
    ["2024-12-23", "2024-12-30", "2025-01-06"].map((date) => timeRow(date, { ac1: 1 })),
    { scenarios: ["ac1"], dateInterval: "week" },
  );

describe("TimeChart: year change of weeks", () => {
  it("is at week 1, where the label shows the new year, not one week later", () => {
    const internals = chart() as unknown as ChartInternals;

    expect(internals.dataModel).toHaveLength(3);
    // week 1 of 2025 starts in the calendar year 2024
    expect(internals.isYearChange(internals.dataModel, 1)).toBe(true);
    expect(internals.isYearChange(internals.dataModel, 2)).toBe(false);
  });
});
