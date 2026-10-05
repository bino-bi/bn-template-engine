import { DataAnalyzer } from "./dataAnalyzer";
import { SiPrefix } from "./model/SiPrefix";
import { createScopedDb } from "../context/scopedDb";

/** Test helper: registers `rows` as a table in a fresh shared db and runs `calculateMeasureScale` against it. */
function callMeasureScale(rows: any[], scenarios: string[], mode: string | null): SiPrefix {
  const sdb = createScopedDb();
  sdb.db.tables["__test"] = { data: rows };
  return DataAnalyzer.calculateMeasureScale(sdb.db, "`__test`", scenarios, mode);
}

describe("Data Analyzer Test", () => {
  it("returns default if empty data object", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data: any[] = [];
    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it("returns 1 if data is  < 1000", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 100 },
      { category: "test2", ac1: 100, ac2: 100, ac3: 999 },
      { category: "test3", ac1: 100, ac2: 100, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it("returns 1000 if data is  >= 1000", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 1000, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "k",
      value: 1000,
    });
  });

  it("returns 1000 if data is  < 1.000.000", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 99999, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "k",
      value: 1000,
    });
  });

  it("returns 1000000 for a negative value beyond a million (ABS path)", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: -10000000, ac2: 99999, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "M",
      value: 1000000,
    });
  });

  it("returns 1000000 if data is  >= 1.000.000", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 9999999, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "M",
      value: 1000000,
    });
  });

  it("returns 0.001 if data is  >= 0.001", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "LEAST")).toEqual({
      prefix: "m",
      value: 0.001,
    });
  });

  it("returns 0.001 if data is  >= 0.001, ignoring mode case", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "least")).toEqual({
      prefix: "m",
      value: 0.001,
    });
  });

  it("returns 0.000001 if mode is my", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "my")).toEqual(new SiPrefix("my", 0.000001));
  });

  it("normalizes the Unicode micro sign μ to my", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "μ")).toEqual({
      prefix: "my",
      value: 0.000001,
    });
  });

  it("returns 1 if mode is _", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "_")).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it("returns 1000 if mode is null (Greatest is default)", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, null)).toEqual({
      prefix: "k",
      value: 1000,
    });
  });

  it("returns 1 if scenarios is null", () => {
    const scenarios: any = [];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it("returns 1 if scenarios is empty", () => {
    const scenarios: string[] = [];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it("returns 1 if scenarios are not in data", () => {
    const scenarios = ["ac4", "ac5", "ac6"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it("returns 1 if data is  null", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data: any[] = [];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "",
      value: 1,
    });
  });

  it("returns 1 if data is empty", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data: any[] = [];

    expect(callMeasureScale(data, scenarios, "GREATEST")).toEqual({
      prefix: "",
      value: 1,
    });
  });

  describe("magnitude edge cases (log10-based prefix picking)", () => {
    const scenarios = ["ac1", "ac2", "ac3"];
    const row = (value: number) => [{ category: "test", ac1: 1, ac2: 1, ac3: value }];

    it("picks n for 1e-7 (exponential toString notation)", () => {
      expect(callMeasureScale(row(1e-7), scenarios, "LEAST")).toEqual({ prefix: "n", value: 1e-9 });
    });

    it("picks Y for 1e24", () => {
      expect(callMeasureScale(row(1e24), scenarios, "GREATEST")).toEqual({ prefix: "Y", value: 1e24 });
    });

    it("picks my for the boundary value 0.0005", () => {
      expect(callMeasureScale(row(0.0005), scenarios, "LEAST")).toEqual({ prefix: "my", value: 1e-6 });
    });

    it("picks f for the femto range 1e-15 (previously hit the stray P)", () => {
      expect(callMeasureScale(row(1e-15), scenarios, "LEAST")).toEqual({ prefix: "f", value: 1e-15 });
    });

    it("keeps the identity prefix between 0.001 and 1000", () => {
      expect(callMeasureScale(row(0.5), scenarios, "LEAST")).toEqual({ prefix: "", value: 1 });
    });

    it("clamps magnitudes beyond the SI range to the outermost prefix", () => {
      expect(callMeasureScale(row(1e27), scenarios, "GREATEST")).toEqual({ prefix: "Y", value: 1e24 });
    });
  });
});

describe("Data Analyzer query failures", () => {
  const db = () => {
    const sdb = createScopedDb();
    sdb.db.tables["__test"] = { data: [{ category: "a", ac1: 5000 }] };
    return sdb.db;
  };

  it("hands a failed query to onError and keeps the identity prefix", () => {
    const onError = jest.fn();

    const prefix = DataAnalyzer.calculateMeasureScale(
      db(),
      "(SELECT * FROM `__test` WHERE category =) AS __src",
      ["ac1"],
      "GREATEST",
      onError,
    );

    expect(prefix).toEqual({ prefix: "", value: 1 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0].message)).toContain("Parse error");
  });

  it("runs no query when only variances are selected", () => {
    const onError = jest.fn();

    const prefix = DataAnalyzer.calculateMeasureScale(db(), "`__test`", ["dac1_pp1"], "GREATEST", onError);

    expect(prefix).toEqual({ prefix: "", value: 1 });
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not report a working query", () => {
    const onError = jest.fn();

    const prefix = DataAnalyzer.calculateMeasureScale(db(), "`__test`", ["ac1"], "GREATEST", onError);

    expect(prefix.prefix).toBe("k");
    expect(onError).not.toHaveBeenCalled();
  });
});
