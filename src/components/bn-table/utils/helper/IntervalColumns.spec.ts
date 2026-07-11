import { DateTime } from "luxon";
import { createScopedDb } from "../../../../context/scopedDb";
import { DateDistance } from "../../../../utils/DateStringFactory";
import {
  coerceBucketKey,
  intervalBucketSQL,
  isDateInterval,
  queryIntervalBuckets,
  resolveIntervalGranularity,
} from "./IntervalColumns";

describe("IntervalColumns helpers", () => {
  const db = createScopedDb().db;

  beforeAll(() => {
    db.tables["intervalDates"] = {
      data: [
        { category: "A", date: "2024-05-20", ac1: 1 },
        { category: "B", date: "2023-03-10", ac1: 2 },
        { category: "A", date: "2023-03-15", ac1: 3 },
        { category: "B", date: null, ac1: 4 },
      ],
    };
    db.tables["intervalSets"] = {
      data: [
        { category: "A", setname: "de", ac1: 1 },
        { category: "A", setname: "at", ac1: 2 },
        { category: "B", setname: "de", ac1: 3 },
        { category: "B", setname: "", ac1: 4 },
      ],
    };
  });

  it("classifies date intervals", () => {
    expect(isDateInterval("year")).toBe(true);
    expect(isDateInterval("setname")).toBe(false);
    expect(isDateInterval("none")).toBe(false);
  });

  it("builds the bucket SQL expression", () => {
    expect(intervalBucketSQL("setname")).toBe("COALESCE([setname],[setName])");
    expect(intervalBucketSQL("year")).toBe("normalizeDate([date], 'year')");
  });

  it("coerces bucket values to stable string keys", () => {
    expect(coerceBucketKey(null)).toBe("");
    expect(coerceBucketKey(undefined)).toBe("");
    expect(coerceBucketKey(" de ")).toBe("de");
    const dt = DateTime.fromISO("2023-01-01T00:00:00");
    expect(coerceBucketKey(dt)).toBe(dt.toISO());
  });

  it("queries date buckets chronologically ascending, skipping blank dates", () => {
    const buckets = queryIntervalBuckets(db, "`intervalDates`", "year", "en");

    expect(buckets.map((bucket) => bucket.label)).toEqual(["2023", "2024"]);
    expect(buckets[0].key < buckets[1].key).toBe(true);
  });

  it("labels month buckets locale-aware", () => {
    const buckets = queryIntervalBuckets(db, "`intervalDates`", "month", "en");

    expect(buckets.map((bucket) => bucket.label)).toEqual(["Mar 2023", "May 2024"]);
  });

  it("queries setname buckets in order of first appearance, blanks as —", () => {
    const buckets = queryIntervalBuckets(db, "`intervalSets`", "setname", "en");

    expect(buckets.map((bucket) => bucket.key)).toEqual(["de", "at", ""]);
    expect(buckets.map((bucket) => bucket.label)).toEqual(["de", "at", "—"]);
  });

  it("passes concrete granularities through and resolves auto from the date span", () => {
    expect(resolveIntervalGranularity(db, "`intervalDates`", "year")).toBe("year");
    // 2023-03-10 .. 2024-05-20 is ~14 months -> month granularity (limit 32)
    expect(resolveIntervalGranularity(db, "`intervalDates`", "auto")).toBe(DateDistance.MONTH);
  });
});
