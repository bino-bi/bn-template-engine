import { DateTime } from "luxon";
import { createScopedDb } from "../../../../context/scopedDb";
import { coerceBucketKey, queryIntervalBuckets } from "./IntervalColumns";

// Run under another zone with `npm run test:tz` (jest copies process.env, so TZ cannot be set here).
describe("dates are bucketed and labeled in UTC", () => {
  const db = createScopedDb().db;
  const utcMidnight = (days: string[]): string[] => days.map((day) => `${day}T00:00:00.000Z`);

  beforeAll(() => {
    db.tables["tzDates"] = {
      data: [
        { category: "A", date: "2024-01-01T00:00:00Z", ac1: 1 },
        { category: "A", date: "2024-01-31T23:30:00+00:00", ac1: 2 },
        { category: "A", date: "2024-04-01T00:00:00Z", ac1: 3 },
        { category: "A", date: "2024-05-20", ac1: 4 },
        { category: "A", date: Date.UTC(2024, 6, 1), ac1: 5 },
        { category: "A", date: "2025-01-01T00:00:00Z", ac1: 6 },
      ],
    };
  });

  it.each([
    [
      "month",
      ["2024-01-01", "2024-04-01", "2024-05-01", "2024-07-01", "2025-01-01"],
      ["Jan 2024", "Apr 2024", "May 2024", "Jul 2024", "Jan 2025"],
    ],
    ["quarter", ["2024-01-01", "2024-04-01", "2024-07-01", "2025-01-01"], ["1Q 2024", "2Q 2024", "3Q 2024", "1Q 2025"]],
    ["year", ["2024-01-01", "2025-01-01"], ["2024", "2025"]],
  ])("the %s buckets start at midnight UTC and show the UTC period", (interval, days, labels) => {
    const buckets = queryIntervalBuckets(db, "`tzDates`", interval, "en");

    expect(buckets.map((bucket) => bucket.key)).toEqual(utcMidnight(days));
    expect(buckets.map((bucket) => bucket.label)).toEqual(labels);
  });

  it("normalizeDate returns the start of the UTC period", () => {
    const rows = db.exec<{ d: DateTime }[]>("SELECT normalizeDate([date], 'month') AS d FROM `tzDates`");

    expect(rows.map((row) => row.d.toISO())).toEqual(
      utcMidnight(["2024-01-01", "2024-01-01", "2024-04-01", "2024-05-01", "2024-07-01", "2025-01-01"]),
    );
  });

  it("a bucket key from epoch millis is the UTC time", () => {
    expect(coerceBucketKey(Date.UTC(2024, 0, 1))).toBe("2024-01-01T00:00:00.000Z");
  });
});
