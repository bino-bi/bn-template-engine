import { DateTime } from "luxon";
import { createScopedDb } from "../../../../context/scopedDb";
import { DateDistance } from "../../../../utils/DateStringFactory";
import {
  coerceBucketKey,
  coerceSetnameIndex,
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

  it("queries setname buckets in order of first appearance, blanks as -", () => {
    const buckets = queryIntervalBuckets(db, "`intervalSets`", "setname", "en");

    expect(buckets.map((bucket) => bucket.key)).toEqual(["de", "at", ""]);
    expect(buckets.map((bucket) => bucket.label)).toEqual(["de", "at", "-"]);
  });

  describe("setname buckets with setnameIndex", () => {
    const keys = (name: string, rows: Record<string, unknown>[]): string[] => {
      db.tables[name] = { data: rows };
      return queryIntervalBuckets(db, "`" + name + "`", "setname", "en").map((bucket) => bucket.key);
    };

    it("sorts by the index when every row has one", () => {
      const rows = [
        { setname: "YTD", setnameIndex: 3 },
        { setname: "Feb", setnameIndex: 1 },
        { setname: "Jan", setnameIndex: 0 },
        { setname: "Mar", setnameIndex: 2 },
        { setname: "Jan", setnameIndex: 0 },
      ];

      expect(keys("setIndexFull", rows)).toEqual(["Jan", "Feb", "Mar", "YTD"]);
    });

    it("puts buckets without an index last, in order of first appearance", () => {
      const rows = [
        { setname: "x" },
        { setname: "b", setnameIndex: 2 },
        { setname: "y", setnameIndex: null },
        { setname: "a", setnameIndex: 1 },
        { setname: "z", setnameIndex: "n/a" },
      ];

      expect(keys("setIndexPartial", rows)).toEqual(["a", "b", "x", "y", "z"]);
    });

    it("takes the smallest index of a setname with different indexes", () => {
      const rows = [
        { setname: "a", setnameIndex: 5 },
        { setname: "b", setnameIndex: 3 },
        { setname: "a", setnameIndex: 1 },
        { setname: "b", setnameIndex: 4 },
      ];

      expect(keys("setIndexConflict", rows)).toEqual(["a", "b"]);
    });

    it("keeps the order of first appearance for equal indexes", () => {
      const rows = [
        { setname: "c", setnameIndex: 1 },
        { setname: "a", setnameIndex: 1 },
        { setname: "b", setnameIndex: 0 },
        { setname: "d", setnameIndex: 1 },
      ];

      expect(keys("setIndexTies", rows)).toEqual(["b", "c", "a", "d"]);
    });

    it("reads setNameIndex and numeric strings, and sorts the blank bucket like the others", () => {
      const rows = [
        { setName: "b", setNameIndex: "2" },
        { setName: "", setNameIndex: 1 },
        { setName: "a", setNameIndex: -1 },
      ];

      expect(keys("setIndexCasing", rows)).toEqual(["a", "", "b"]);
    });

    it("leaves date buckets in chronological order", () => {
      db.tables["setIndexDates"] = {
        data: [
          { date: "2023-03-10", setname: "a", setnameIndex: 2 },
          { date: "2024-05-20", setname: "b", setnameIndex: 1 },
        ],
      };

      const buckets = queryIntervalBuckets(db, "`setIndexDates`", "year", "en");
      expect(buckets.map((bucket) => bucket.label)).toEqual(["2023", "2024"]);
    });
  });

  it("reads a setnameIndex as a number", () => {
    expect(coerceSetnameIndex(2)).toBe(2);
    expect(coerceSetnameIndex("2")).toBe(2);
    expect(coerceSetnameIndex(0)).toBe(0);
    expect(coerceSetnameIndex(" ")).toBeUndefined();
    expect(coerceSetnameIndex("x")).toBeUndefined();
    expect(coerceSetnameIndex(null)).toBeUndefined();
    expect(coerceSetnameIndex(undefined)).toBeUndefined();
    expect(coerceSetnameIndex(NaN)).toBeUndefined();
    expect(coerceSetnameIndex(true)).toBeUndefined();
  });

  it("passes concrete granularities through and resolves auto from the date span", () => {
    expect(resolveIntervalGranularity(db, "`intervalDates`", "year")).toBe("year");
    // 2023-03-10 .. 2024-05-20 is ~14 months -> month granularity (limit 32)
    expect(resolveIntervalGranularity(db, "`intervalDates`", "auto")).toBe(DateDistance.MONTH);
  });
});
