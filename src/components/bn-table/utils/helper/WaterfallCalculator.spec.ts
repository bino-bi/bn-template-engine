import { computeWaterfall, hasGroupingStructure, WaterfallBarData } from "./WaterfallCalculator";
import { TableType } from "../model";
import { DataQueryResultRow } from "../../../../utils/model/DataQueryResultRow";

function entry(ac1: number | null, operation: string = "+", category: string = "cat"): DataQueryResultRow {
  return { type: "ENTRY", category, operation, ac1 };
}

function sum(ac1: number, type: "SUM" | "GROUP_SUM" = "SUM"): DataQueryResultRow {
  return { type, operation: "=", ac1 };
}

function drill(ac1: number, type: "DRILLELEMENT" | "PARTELEMENT" = "DRILLELEMENT"): DataQueryResultRow {
  return { type, operation: null, ac1 };
}

function bar(result: ReturnType<typeof computeWaterfall>, row: DataQueryResultRow): WaterfallBarData {
  const data = result.get(row, "ac1");
  expect(data).toBeDefined();
  return data!;
}

describe("hasGroupingStructure", () => {
  it("is false for flat entry-only data", () => {
    expect(hasGroupingStructure([[entry(1), entry(2)]])).toBe(false);
  });

  it.each(["SUM", "GROUP_SUM", "DRILLELEMENT", "PARTELEMENT"])("is true when a %s row exists", (type) => {
    expect(hasGroupingStructure([[entry(1), { type, ac1: 1 }]])).toBe(true);
  });
});

describe("computeWaterfall", () => {
  it("cascades entries from the running total", () => {
    const rows = [entry(10), entry(5), entry(-3)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[0])).toMatchObject({ start: 0, end: 10, kind: "cascade" });
    expect(bar(result, rows[1])).toMatchObject({ start: 10, end: 15, kind: "cascade" });
    expect(bar(result, rows[2])).toMatchObject({ start: 15, end: 12, kind: "cascade" });
    expect(bar(result, rows[0])).toMatchObject({ min: 0, max: 15 });
  });

  it("anchors SUM rows at zero and resets the running total", () => {
    const rows = [entry(10), entry(5), sum(12), entry(3)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[2])).toMatchObject({ start: 0, end: 12, kind: "anchor" });
    expect(bar(result, rows[3])).toMatchObject({ start: 12, end: 15 });
  });

  it("continues the cascade across group boundaries after a GROUP_SUM anchor", () => {
    const groupA = [entry(10), entry(5), sum(15, "GROUP_SUM")];
    const groupB = [entry(-4)];
    const result = computeWaterfall([groupA, groupB], ["ac1"], TableType.SUM);

    expect(bar(result, groupA[2])).toMatchObject({ start: 0, end: 15, kind: "anchor" });
    expect(bar(result, groupB[0])).toMatchObject({ start: 15, end: 11 });
  });

  it("re-anchors consecutive sum rows independently", () => {
    const rows = [entry(15), sum(15, "GROUP_SUM"), sum(12), entry(1)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[1])).toMatchObject({ start: 0, end: 15 });
    expect(bar(result, rows[2])).toMatchObject({ start: 0, end: 12 });
    expect(bar(result, rows[3])).toMatchObject({ start: 12, end: 13 });
  });

  it("sub-cascades thereof rows across a positive parent without touching the running total", () => {
    const rows = [entry(10), entry(15), drill(6), drill(4), entry(2)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[2])).toMatchObject({ start: 10, end: 16, kind: "thereof", parentStart: 10, parentEnd: 25 });
    expect(bar(result, rows[3])).toMatchObject({ start: 16, end: 20, kind: "thereof" });
    expect(bar(result, rows[4])).toMatchObject({ start: 25, end: 27 });
  });

  it("sub-cascades thereof rows leftward under a negative parent", () => {
    const rows = [entry(15), entry(-5), drill(2)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[1])).toMatchObject({ start: 15, end: 10 });
    expect(bar(result, rows[2])).toMatchObject({ start: 15, end: 13, parentStart: 15, parentEnd: 10 });
  });

  it("scales partof segments by their share of the parent width", () => {
    const rows = [entry(10), entry(10), drill(0.25, "PARTELEMENT")];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[2])).toMatchObject({
      start: 10,
      end: 12.5,
      kind: "partof",
      parentStart: 10,
      parentEnd: 20,
    });
  });

  it("skips NaN entries without moving the running total and orphans their drill children", () => {
    const rows = [entry(10), entry(NaN), drill(3), entry(5)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(result.get(rows[1], "ac1")).toBeUndefined();
    expect(result.get(rows[2], "ac1")).toBeUndefined();
    expect(bar(result, rows[3])).toMatchObject({ start: 10, end: 15 });
  });

  it("cascades REST rows like regular entries", () => {
    const rows = [entry(10), entry(4, "+", "REST")];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[1])).toMatchObject({ start: 10, end: 14, kind: "cascade" });
  });

  it("applies the operation sign to OPT entries but not to OPT sum rows", () => {
    const rows = [entry(10, "+"), entry(5, "-"), sum(5)];
    const result = computeWaterfall([rows], ["ac1"], TableType.OPT);

    expect(bar(result, rows[1])).toMatchObject({ start: 10, end: 5 });
    expect(bar(result, rows[2])).toMatchObject({ start: 0, end: 5 });
  });

  it("keeps entry values signed as-is for non-OPT types regardless of operation", () => {
    const rows = [entry(-5, "-"), sum(-5)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[0])).toMatchObject({ start: 0, end: -5 });
  });

  it("always includes zero in the column extents", () => {
    const positive = [entry(10), entry(5)];
    const negative = [entry(-10), entry(-5)];
    const posResult = computeWaterfall([positive], ["ac1"], TableType.SUM);
    const negResult = computeWaterfall([negative], ["ac1"], TableType.SUM);

    expect(bar(posResult, positive[0])).toMatchObject({ min: 0, max: 15 });
    expect(bar(negResult, negative[0])).toMatchObject({ min: -15, max: 0 });
  });

  it("computes independent geometry per column", () => {
    const rows = [
      { type: "ENTRY", category: "a", operation: "+", ac1: 10, pl1: 20 },
      { type: "ENTRY", category: "b", operation: "+", ac1: 5, pl1: 1 },
    ];
    const result = computeWaterfall([rows], ["ac1", "pl1"], TableType.SUM);

    expect(result.get(rows[1], "ac1")).toMatchObject({ start: 10, end: 15, max: 15 });
    expect(result.get(rows[1], "pl1")).toMatchObject({ start: 20, end: 21, max: 21 });
  });
});
