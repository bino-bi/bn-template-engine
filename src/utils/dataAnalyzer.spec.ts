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

  it("returns 1000 if data is  < 1.000.000", () => {
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

  it("returns 0.000001 if mode is μ", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "my")).toEqual(new SiPrefix("my", 0.000001));
  });

  it("returns 0.000001 if mode is μ", () => {
    const scenarios = ["ac1", "ac2", "ac3"];

    const data = [
      { category: "test", ac1: 100, ac2: 100, ac3: 1000 },
      { category: "test2", ac1: 100, ac2: 0.001, ac3: 100 },
      { category: "test3", ac1: 1000, ac2: 1000, ac3: 100 },
    ];

    expect(callMeasureScale(data, scenarios, "my")).toEqual({
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
});
