import { computeWaterfall, hasGroupingStructure, restSignedAlias, WaterfallBarData } from "./WaterfallCalculator";
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

  it("restarts the cascade at zero for every row group", () => {
    const groupA = [{ type: "GROUPHEAD" }, entry(10), entry(5), sum(15, "GROUP_SUM")];
    const groupB = [{ type: "GROUPHEAD" }, entry(4, "-"), entry(2, "-"), sum(-6, "GROUP_SUM")];
    const total = [sum(9)];
    const result = computeWaterfall([groupA, groupB, total], ["ac1"], TableType.OPT);

    expect(bar(result, groupA[3])).toMatchObject({ start: 0, end: 15, kind: "anchor" });
    expect(bar(result, groupB[1])).toMatchObject({ start: 0, end: -4, kind: "cascade" });
    expect(bar(result, groupB[2])).toMatchObject({ start: -4, end: -6, kind: "cascade" });
    expect(bar(result, groupB[3])).toMatchObject({ start: 0, end: -6, kind: "anchor" });
    expect(bar(result, total[0])).toMatchObject({ start: 0, end: 9, kind: "anchor" });
  });

  it("restarts the cascade after a group sum when the groups have no head row", () => {
    const groupA = [entry(10), entry(5), sum(15, "GROUP_SUM")];
    const groupB = [entry(4, "-"), sum(-4, "GROUP_SUM")];
    const result = computeWaterfall([groupA, groupB], ["ac1"], TableType.OPT);

    expect(bar(result, groupB[0])).toMatchObject({ start: 0, end: -4, kind: "cascade" });
    expect(bar(result, groupB[1])).toMatchObject({ start: 0, end: -4, kind: "anchor" });
  });

  it("walks on from a running group sum, with and without head rows", () => {
    for (const head of [[], [{ type: "GROUPHEAD" }]]) {
      const groupA = [...head, entry(10), entry(5), sum(15, "GROUP_SUM")];
      const groupB = [...head, entry(4, "-"), drill(3), sum(11, "GROUP_SUM")];
      const groupC = [...head, entry(2)];
      const result = computeWaterfall([groupA, groupB, groupC], ["ac1"], TableType.OPT, true);
      const [expense, part, running] = groupB.slice(head.length);

      expect(bar(result, groupA[head.length + 2])).toMatchObject({ start: 0, end: 15, kind: "anchor" });
      expect(bar(result, expense)).toMatchObject({ start: 15, end: 11, kind: "cascade" });
      expect(bar(result, part)).toMatchObject({ start: 15, end: 12, kind: "thereof" });
      expect(bar(result, running)).toMatchObject({ start: 0, end: 11, kind: "anchor" });
      expect(bar(result, groupC[head.length])).toMatchObject({ start: 11, end: 13, kind: "cascade" });
    }
  });

  it("restarts the cascade for a row group without a sum row", () => {
    const groupA = [{ type: "GROUPHEAD" }, entry(10), drill(4)];
    const groupB = [{ type: "GROUPHEAD" }, entry(7)];
    const result = computeWaterfall([groupA, groupB], ["ac1"], TableType.LIST);

    expect(bar(result, groupB[1])).toMatchObject({ start: 0, end: 7 });
  });

  it("continues the running total after a subtotal row inside one group", () => {
    const rows = [entry(10), entry(4, "-"), sum(6), entry(3), entry(1, "-"), sum(8)];
    const result = computeWaterfall([rows], ["ac1"], TableType.OPT);

    expect(bar(result, rows[3])).toMatchObject({ start: 6, end: 9 });
    expect(bar(result, rows[4])).toMatchObject({ start: 9, end: 8 });
    expect(bar(result, rows[5])).toMatchObject({ start: 0, end: 8, kind: "anchor" });
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

    expect(bar(result, rows[2])).toMatchObject({ start: 10, end: 16, kind: "thereof" });
    expect(bar(result, rows[3])).toMatchObject({ start: 16, end: 20, kind: "thereof" });
    expect(bar(result, rows[4])).toMatchObject({ start: 25, end: 27 });
  });

  it("sub-cascades thereof rows leftward under a negative parent", () => {
    const rows = [entry(15), entry(-5), drill(2)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[1])).toMatchObject({ start: 15, end: 10 });
    expect(bar(result, rows[2])).toMatchObject({ start: 15, end: 13 });
  });

  it("scales partof segments by their share of the parent width", () => {
    const rows = [entry(10), entry(10), drill(0.25, "PARTELEMENT")];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);

    expect(bar(result, rows[2])).toMatchObject({
      start: 10,
      end: 12.5,
      kind: "partof",
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

  it("walks a REST row of only '-' rows of an OPT table to the left", () => {
    const rest = { type: "ENTRY", category: "REST", restOperation: "-", ac1: 4 };
    const rows = [entry(10), rest, sum(6)];
    const result = computeWaterfall([rows], ["ac1"], TableType.OPT);

    expect(bar(result, rest)).toMatchObject({ start: 10, end: 6, kind: "cascade" });
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

describe("computeWaterfall on an absolute variance column", () => {
  const column = "dac1_pl1_op";
  const row = (type: string, value: number | null, operation: string | null = "+"): DataQueryResultRow => ({
    type,
    operation,
    [column]: value,
  });
  const walk = (groups: DataQueryResultRow[][], type = TableType.OPTNOTOTAL, runningSum = false, above = false) => {
    const result = computeWaterfall(groups, [column], type, runningSum, above);
    return (r: DataQueryResultRow) => result.get(r, column);
  };

  it("moves a '-' row with a positive variance to the left on an opt table", () => {
    const rows = [row("ENTRY", 9), row("ENTRY", 7, "-"), row("ENTRY", -2, "-")];
    const bar = walk([rows]);

    expect(bar(rows[0])).toMatchObject({ start: 0, end: 9, kind: "cascade" });
    expect(bar(rows[1])).toMatchObject({ start: 9, end: 2 });
    expect(bar(rows[2])).toMatchObject({ start: 2, end: 4 });
  });

  it("takes the values of a sum table as they are", () => {
    const rows = [row("ENTRY", 9), row("ENTRY", -7, "-"), row("SUM", 2, "=")];
    const bar = walk([rows], TableType.SUM);

    expect(bar(rows[1])).toMatchObject({ start: 9, end: 2 });
    expect(bar(rows[2])).toMatchObject({ start: 0, end: 2, kind: "anchor" });
  });

  it("restarts every group at zero and joins only the rows of one walk", () => {
    const groupA = [row("ENTRY", 4), row("ENTRY", -1), row("GROUP_SUM", 3, "=")];
    const groupB = [row("ENTRY", 5, "-"), row("GROUP_SUM", -5, "=")];
    const total = [row("SUM", -2, "=")];
    const bar = walk([groupA, groupB, total], TableType.OPT);

    expect(bar(groupA[0])!.connectors).toEqual([{ at: 4, part: "bottom" }]);
    expect(bar(groupA[1])!.connectors).toEqual([
      { at: 4, part: "top" },
      { at: 3, part: "bottom" },
    ]);
    expect(bar(groupA[2])).toMatchObject({ start: 0, end: 3, connectors: [{ at: 3, part: "top" }] });
    expect(bar(groupB[0])).toMatchObject({ start: 0, end: -5, connectors: [{ at: -5, part: "bottom" }] });
    expect(bar(groupB[1])!.connectors).toEqual([{ at: -5, part: "top" }]);
    expect(bar(total[0])).toMatchObject({ start: 0, end: -2, kind: "anchor" });
    expect(bar(total[0])!.connectors).toBeUndefined();
  });

  it("walks on from a running group sum and joins it to the next row", () => {
    const groupA = [row("ENTRY", 4), row("GROUP_SUM", 4, "=")];
    const groupB = [row("ENTRY", 1, "-"), row("GROUP_SUM", 3, "=")];
    const bar = walk([groupA, groupB], TableType.OPTNOTOTAL, true);

    expect(bar(groupA[1])!.connectors).toEqual([
      { at: 4, part: "top" },
      { at: 4, part: "bottom" },
    ]);
    expect(bar(groupB[0])).toMatchObject({ start: 4, end: 3 });
    expect(bar(groupB[0])!.connectors).toEqual([
      { at: 4, part: "top" },
      { at: 3, part: "bottom" },
    ]);
    expect(bar(groupB[1])).toMatchObject({ start: 0, end: 3, kind: "anchor" });
  });

  it("does not join rows across a group head row", () => {
    const groupA = [row("GROUPHEAD", null, null), row("ENTRY", 4), row("GROUP_SUM", 4, "=")];
    const groupB = [row("GROUPHEAD", null, null), row("ENTRY", 1), row("GROUP_SUM", 5, "=")];
    const bar = walk([groupA, groupB], TableType.OPTNOTOTAL, true);

    expect(bar(groupA[2])!.connectors).toEqual([{ at: 4, part: "top" }]);
    expect(bar(groupB[1])).toMatchObject({ start: 4, end: 5, connectors: [{ at: 5, part: "bottom" }] });
  });

  // expense children with mixed signs: 6 worse, 2 better, so the expense row is 4 worse
  const expenses = () => [
    row("ENTRY", 10),
    row("ENTRY", 4, "-"),
    row("DRILLELEMENT", 6, null),
    row("DRILLELEMENT", -2, null),
    row("ENTRY", 1),
  ];

  it("walks thereof rows from the parent start by their signed value", () => {
    const rows = expenses();
    const bar = walk([rows]);

    expect(bar(rows[1])).toMatchObject({ start: 10, end: 6 });
    expect(bar(rows[2])).toMatchObject({ start: 10, end: 4, kind: "thereof" });
    expect(bar(rows[3])).toMatchObject({ start: 4, end: 6, kind: "thereof" });
    expect(bar(rows[2])).toBeDefined();
    // the first child leaves the parent bar, the running total is the parent end
    expect(bar(rows[4])).toMatchObject({ start: 6, end: 7, min: 0, max: 10 });
  });

  it("joins thereof rows below the parent and passes the parent end beside them", () => {
    const rows = expenses();
    const bar = walk([rows]);

    expect(bar(rows[1])!.connectors).toEqual([
      { at: 10, part: "top" },
      { at: 10, part: "bottom" },
      { at: 6, part: "bottom" },
    ]);
    expect(bar(rows[2])!.connectors).toEqual([
      { at: 4, part: "bottom" },
      { at: 10, part: "top" },
      { at: 6, part: "through" },
    ]);
    expect(bar(rows[3])!.connectors).toEqual([
      { at: 4, part: "top" },
      { at: 6, part: "through" },
    ]);
    expect(bar(rows[4])!.connectors).toEqual([{ at: 6, part: "top" }]);
  });

  it("passes the line to the parent beside thereof rows printed above it", () => {
    const rows = expenses();
    const bar = walk([rows], TableType.OPTNOTOTAL, false, true);

    expect(bar(rows[0])!.connectors).toEqual([{ at: 10, part: "bottom" }]);
    expect(bar(rows[2])!.connectors).toEqual([
      { at: 10, part: "through" },
      { at: 4, part: "bottom" },
    ]);
    expect(bar(rows[3])!.connectors).toEqual([
      { at: 10, part: "through" },
      { at: 4, part: "top" },
      { at: 6, part: "bottom" },
    ]);
    expect(bar(rows[1])!.connectors).toEqual([
      { at: 10, part: "top" },
      { at: 6, part: "top" },
      { at: 6, part: "bottom" },
    ]);
    expect(bar(rows[4])!.connectors).toEqual([{ at: 6, part: "top" }]);
  });

  it("gives a partof row no bar and no line beside it", () => {
    const rows = [row("ENTRY", 5), row("PARTELEMENT", 0.5, null), row("ENTRY", 2)];
    const bar = walk([rows]);

    expect(bar(rows[1])).toBeUndefined();
    expect(bar(rows[0])!.connectors).toBeUndefined();
    expect(bar(rows[2])).toMatchObject({ start: 5, end: 7 });
  });

  it("breaks only the line on the side where a partof row is printed", () => {
    const rows = [row("ENTRY", 4), row("ENTRY", 3), row("PARTELEMENT", 0.5, null), row("ENTRY", 1), row("SUM", 8, "=")];
    const bar = walk([rows], TableType.OPT);

    expect(bar(rows[0])!.connectors).toEqual([{ at: 4, part: "bottom" }]);
    expect(bar(rows[1])!.connectors).toEqual([{ at: 4, part: "top" }]);
    expect(bar(rows[3])!.connectors).toEqual([{ at: 8, part: "bottom" }]);
  });

  it("breaks the line below a parent whose thereof row below it has no value", () => {
    const rows = [row("ENTRY", 4), row("ENTRY", 3), row("DRILLELEMENT", null, null), row("ENTRY", 1)];
    const bar = walk([rows]);

    expect(bar(rows[0])!.connectors).toEqual([{ at: 4, part: "bottom" }]);
    expect(bar(rows[1])!.connectors).toEqual([{ at: 4, part: "top" }]);
    expect(bar(rows[3])!.connectors).toBeUndefined();
  });

  it("breaks the line above a parent whose thereof row above it has no value", () => {
    const rows = [row("ENTRY", 4), row("ENTRY", 3), row("DRILLELEMENT", null, null), row("ENTRY", 1)];
    const bar = walk([rows], TableType.OPTNOTOTAL, false, true);

    expect(bar(rows[0])!.connectors).toBeUndefined();
    expect(bar(rows[1])!.connectors).toEqual([{ at: 7, part: "bottom" }]);
    expect(bar(rows[3])!.connectors).toEqual([{ at: 7, part: "top" }]);
  });

  it("keeps the line above a parent with a partof row when its thereof rows are printed above", () => {
    const rows = [row("ENTRY", 4), row("ENTRY", 3), row("PARTELEMENT", 0.5, null), row("ENTRY", 1)];
    const bar = walk([rows], TableType.OPTNOTOTAL, false, true);

    expect(bar(rows[0])!.connectors).toEqual([{ at: 4, part: "bottom" }]);
    expect(bar(rows[1])!.connectors).toEqual([{ at: 4, part: "top" }]);
    expect(bar(rows[3])!.connectors).toBeUndefined();
  });

  it("walks a REST row of only '-' rows to the left on an opt table, so the walk ends at the sum", () => {
    const rest = { type: "ENTRY", category: "REST", restOperation: "-", [column]: 3 };
    const rows = [row("ENTRY", 10), row("ENTRY", 3, "-"), rest, row("SUM", 4, "=")];
    const bar = walk([rows], TableType.OPT);

    expect(bar(rest)).toMatchObject({ start: 7, end: 4 });
    expect(bar(rows[3])!.connectors).toEqual([{ at: 4, part: "top" }]);
  });

  it("walks a REST row of mixed operations by its signed sum", () => {
    // REST folds +2 and -5: it prints 7, the walk moves by -3
    const rest = { type: "ENTRY", category: "REST", restOperation: "+", [column]: 7, [restSignedAlias(column)]: -3 };
    const rows = [row("ENTRY", 10), rest, row("SUM", 7, "=")];
    const bar = walk([rows], TableType.OPT);

    expect(bar(rest)).toMatchObject({ start: 10, end: 7 });
  });

  it("keeps the running total over a NaN entry and joins no line across it", () => {
    const rows = [row("ENTRY", 5), row("ENTRY", NaN), row("ENTRY", 2), row("SUM", 7, "=")];
    const bar = walk([rows]);

    expect(bar(rows[1])).toBeUndefined();
    expect(bar(rows[0])!.connectors).toBeUndefined();
    expect(bar(rows[2])).toMatchObject({ start: 5, end: 7, connectors: [{ at: 7, part: "bottom" }] });
  });

  it("gives a scenario column in the same call its own connectors", () => {
    const rows = [
      { type: "ENTRY", operation: "+", ac1: 10, [column]: 1 },
      { type: "ENTRY", operation: "-", ac1: 4, [column]: 2 },
      { type: "DRILLELEMENT", operation: null, ac1: 3, [column]: -1 },
    ];
    const result = computeWaterfall([rows], ["ac1", column], TableType.OPT);

    // the scenario walk: 0 to 10, back to 6; the thereof row from 10 to 7 beside it
    expect(result.get(rows[1], "ac1")!.connectors).toEqual([
      { at: 10, part: "top" },
      { at: 10, part: "bottom" },
    ]);
    expect(result.get(rows[2], "ac1")).toMatchObject({ start: 10, end: 7 });
    expect(result.get(rows[2], column)).toMatchObject({ start: 1, end: 2 });
    expect(result.has("ac1") && result.has(column)).toBe(true);
    expect(result.has("pl1")).toBe(false);
  });
});

describe("computeWaterfall on a scenario column: connectors and parts", () => {
  it("draws no line past a printed thereof row without a value", () => {
    const rows = [entry(10), { type: "DRILLELEMENT", operation: null, ac1: null }, drill(4), entry(2)];
    const result = computeWaterfall([rows], ["ac1"], TableType.SUM);
    // the parent does not join the thereof row below the gap, and the walk stops there
    expect(bar(result, rows[0]).connectors).toBeUndefined();
    expect(bar(result, rows[3]).connectors).toBeUndefined();
  });

  it("joins partof rows below their parent also when thereof rows print above", () => {
    const parent = entry(10);
    const share = drill(0.4, "PARTELEMENT");
    const result = computeWaterfall([[parent, share]], ["ac1"], TableType.SUM, false, true);
    expect(bar(result, parent).connectors).toEqual([{ at: 0, part: "bottom" }]);
    expect(bar(result, share).connectors).toEqual([{ at: 0, part: "top" }]);
  });

  it("draws the part inside the bar from its start, never on a partof row", () => {
    const rows = [
      { type: "ENTRY", operation: "+", ac1: 4, fc1: 10 },
      { type: "ENTRY", operation: "-", ac1: 2, fc1: 5 },
      { type: "PARTELEMENT", operation: null, ac1: 0.3, fc1: 0.5 },
    ];
    const result = computeWaterfall([rows], ["fc1"], TableType.OPT, false, false, new Map([["fc1", "ac1"]]));
    expect(result.get(rows[0], "fc1")!.part).toEqual({ scenario: "ac1", value: 4, end: 4 });
    // the cost goes left from 10: its part too
    expect(result.get(rows[1], "fc1")!.part).toEqual({ scenario: "ac1", value: 2, end: 8 });
    expect(result.get(rows[2], "fc1")!.part).toBeUndefined();
  });

  it("takes the signed sum of the part on a REST row", () => {
    const rest = { type: "ENTRY", restOperation: "+", ac1: 175, ac1__signed: 5, fc1: 20, fc1__signed: 20 };
    const result = computeWaterfall([[rest]], ["fc1"], TableType.OPT, false, false, new Map([["fc1", "ac1"]]));
    expect(result.get(rest, "fc1")!.part!.end).toBe(5);
  });
});
