import { baselineOffsets, BaselineCell, parseCaptions, parseSpan, placeCells, sameOffsets } from "./cellLayout";

const cell = (slot: string, row: number, column: number, extra: Partial<BaselineCell> = {}): BaselineCell => ({
  slot,
  row,
  column,
  top: 0,
  left: 0,
  ...extra,
});

describe("baselineOffsets", () => {
  it("pads every cell of a row down to the lowest baseline", () => {
    const offsets = baselineOffsets(
      [cell("0-0", 0, 0, { y: 120 }), cell("0-1", 0, 1, { y: 200 }), cell("1-0", 1, 0, { y: 400 })],
      true,
      false,
    );
    expect(offsets).toEqual({ "0-0": { top: 80 }, "0-1": { top: 0 }, "1-0": { top: 0 } });
  });

  it("measures from where a baseline would be without the offset already applied", () => {
    // 0-0 is padded by 80 already and now sits on 200: nothing changes
    const offsets = baselineOffsets(
      [cell("0-0", 0, 0, { y: 200, top: 80 }), cell("0-1", 0, 1, { y: 200 })],
      true,
      false,
    );
    expect(offsets).toEqual({ "0-0": { top: 80 }, "0-1": { top: 0 } });
  });

  it("sends a cell without a baseline to the bottom", () => {
    const offsets = baselineOffsets([cell("0-0", 0, 0, { y: 50 }), cell("0-1", 0, 1)], true, false);
    expect(offsets["0-1"]).toEqual({ bottom: true });
  });

  it("pads every cell of a column right to the rightmost baseline, and leaves a cell without one", () => {
    const offsets = baselineOffsets(
      [cell("0-0", 0, 0, { x: 30 }), cell("1-0", 1, 0, { x: 75.5 }), cell("2-0", 2, 0)],
      false,
      true,
    );
    // the free space on the right gives every cell of the column the same width
    expect(offsets).toEqual({
      "0-0": { left: 45.5 },
      "1-0": { left: 0, right: 45.5 },
      "2-0": { right: 45.5 },
    });
  });
});

describe("sameOffsets", () => {
  it("treats less than half a px as the same", () => {
    expect(sameOffsets({ a: { top: 10 } }, { a: { top: 10.4 } })).toBe(true);
    expect(sameOffsets({ a: { top: 10 } }, { a: { top: 10.6 } })).toBe(false);
    expect(sameOffsets({ a: {} }, { a: { bottom: true } })).toBe(false);
    expect(sameOffsets({}, { a: { top: 0 } })).toBe(true);
    expect(sameOffsets({ a: { right: 10 } }, { a: {} })).toBe(false);
  });
});

describe("parseCaptions", () => {
  it("reads an object from slot name to text and drops empty texts", () => {
    expect(parseCaptions('{"0-0": "Berlin", "0-1": ""}')).toEqual({ "0-0": "Berlin" });
    expect(parseCaptions("")).toEqual({});
  });

  it("rejects anything else", () => {
    expect(parseCaptions("not json")).toBeUndefined();
    expect(parseCaptions('["Berlin"]')).toBeUndefined();
    expect(parseCaptions('{"0-0": 1}')).toBeUndefined();
  });
});

describe("parseSpan", () => {
  it("reads a whole number from 1, and 1 without a value", () => {
    expect(parseSpan(null)).toBe(1);
    expect(parseSpan("")).toBe(1);
    expect(parseSpan("1")).toBe(1);
    expect(parseSpan(" 3 ")).toBe(3);
  });

  it("rejects everything else", () => {
    for (const value of ["0", "-2", "1.5", "two", "2px"]) expect(parseSpan(value)).toBeUndefined();
  });
});

describe("placeCells", () => {
  const spans = (map: Record<string, { rowSpan?: number; columnSpan?: number }>) => (row: number, column: number) => {
    const span = map[`${row}-${column}`];
    return span && { rowSpan: span.rowSpan ?? 1, columnSpan: span.columnSpan ?? 1 };
  };
  const at = (cells: { row: number; column: number }[]) => cells.map((cell) => `${cell.row}-${cell.column}`);

  it("gives every position its cell without a span", () => {
    const { cells, covered } = placeCells(2, 2, () => undefined);
    expect(cells).toEqual([
      { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
      { row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
      { row: 1, column: 0, rowSpan: 1, columnSpan: 1 },
      { row: 1, column: 1, rowSpan: 1, columnSpan: 1 },
    ]);
    expect(covered).toEqual([]);
  });

  it("leaves out the positions a span covers", () => {
    const { cells, covered } = placeCells(3, 3, spans({ "0-0": { rowSpan: 2, columnSpan: 2 } }));
    expect(at(cells)).toEqual(["0-0", "0-2", "1-2", "2-0", "2-1", "2-2"]);
    expect(at(covered)).toEqual(["0-1", "1-0", "1-1"]);
    expect(covered[0].by).toBe(cells[0]);
  });

  it("ends a span at the edge of the grid", () => {
    const { cells } = placeCells(2, 2, spans({ "1-1": { rowSpan: 5, columnSpan: 5 } }));
    expect(cells[3]).toEqual({ row: 1, column: 1, rowSpan: 1, columnSpan: 1 });
  });

  it("ends a span before a position that a cell from above has taken", () => {
    const { cells } = placeCells(2, 3, spans({ "0-1": { rowSpan: 2 }, "1-0": { columnSpan: 3 } }));
    expect(cells.find((cell) => cell.row === 1)).toEqual({ row: 1, column: 0, rowSpan: 1, columnSpan: 1 });
    expect(at(cells)).toEqual(["0-0", "0-1", "0-2", "1-0", "1-2"]);
  });

  it("has no cells without rows or columns", () => {
    expect(placeCells(0, 3, () => undefined).cells).toEqual([]);
    expect(placeCells(3, 0, () => undefined).cells).toEqual([]);
  });
});

describe("baselineOffsets with spans", () => {
  it("leaves a cell over several rows out of the rows, and keeps it in its column", () => {
    const offsets = baselineOffsets(
      [
        cell("0-0", 0, 0, { y: 300, x: 10, rowSpan: 2 }),
        cell("0-1", 0, 1, { y: 100 }),
        cell("0-2", 0, 2, { y: 150 }),
        cell("2-0", 2, 0, { y: 500, x: 40 }),
      ],
      true,
      true,
    );
    expect(offsets["0-0"]).toEqual({ left: 30 });
    expect(offsets["0-1"].top).toBe(50);
    expect(offsets["0-2"].top).toBe(0);
    expect(offsets["2-0"]).toEqual({ top: 0, left: 0, right: 30 });
  });

  it("leaves a cell over several columns out of the columns, and keeps it in its row", () => {
    const offsets = baselineOffsets(
      [
        cell("0-0", 0, 0, { y: 100, x: 80, columnSpan: 2 }),
        cell("1-0", 1, 0, { x: 20 }),
        cell("0-2", 0, 2, { y: 130 }),
      ],
      true,
      true,
    );
    expect(offsets["0-0"]).toEqual({ top: 30 });
    expect(offsets["1-0"].left).toBe(0);
    expect(offsets["1-0"].right).toBeUndefined();
  });
});
