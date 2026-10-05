import { DateTime, DurationLike } from "luxon";
import { TimeChart } from "./TimeChart";
import { DateDistance } from "../../../utils/DateStringFactory";
import { buildTimeChart, timeRow } from "../../../utils/testing/timeChart";

const START = DateTime.utc(2022, 1, 1);

const series = (count: number, step: (index: number) => DurationLike): DateTime[] =>
  Array.from({ length: count }, (_, index) => START.plus(step(index)));

const autoChart = (dates: (string | number)[]): TimeChart =>
  buildTimeChart(
    dates.map((date) => timeRow(date, { ac1: 100 })),
    { scenarios: ["ac1"], dateInterval: "auto" },
  );

const interval = (chart: TimeChart): DateDistance => (chart as unknown as { dateInterval: DateDistance }).dateInterval;

const periods = (chart: TimeChart): string[] =>
  (chart as unknown as { dataModel: { date: DateTime }[] }).dataModel.map((entry) => entry.date.toISODate() as string);

const isoDates = (dates: DateTime[]): string[] => dates.map((date) => date.toISODate() as string);

describe("TimeChart: auto date interval", () => {
  it("shows three years of monthly ISO dates as 12 quarters", () => {
    const chart = autoChart(isoDates(series(36, (index) => ({ months: index }))));

    expect(interval(chart)).toBe(DateDistance.QUARTER);
    expect(periods(chart)).toHaveLength(12);
    expect(periods(chart)[0]).toBe("2022-01-01");
    expect(periods(chart)[11]).toBe("2024-10-01");
  });

  it.each([
    ["20 days", 20, (index: number) => ({ days: index }), DateDistance.DAY],
    ["20 weeks", 20, (index: number) => ({ weeks: index }), DateDistance.WEEK],
    ["24 months", 24, (index: number) => ({ months: index }), DateDistance.MONTH],
    ["36 months", 36, (index: number) => ({ months: index }), DateDistance.QUARTER],
    ["10 years", 10, (index: number) => ({ years: index }), DateDistance.YEAR],
  ])("resolves %s of ISO dates", (_name, count, step, expected) => {
    const chart = autoChart(isoDates(series(count, step)));

    expect(interval(chart)).toBe(expected);
  });

  it("resolves ISO dates with a time part", () => {
    const dates = series(24, (index) => ({ months: index })).map((date) => date.toISO() as string);

    expect(interval(autoChart(dates))).toBe(DateDistance.MONTH);
  });

  it("resolves a series with more distinct dates than a function call takes arguments", () => {
    // one value per minute over about five months
    const start = START.toMillis();
    const dates = Array.from({ length: 200000 }, (_, index) => start + index * 60000);

    expect(interval(autoChart(dates))).toBe(DateDistance.WEEK);
  });

  it("resolves epoch millis as before", () => {
    const dates = series(24, (index) => ({ months: index })).map((date) => date.toMillis());

    expect(interval(autoChart(dates))).toBe(DateDistance.MONTH);
  });
});
