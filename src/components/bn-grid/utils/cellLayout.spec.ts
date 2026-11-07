import { baselineOffsets, BaselineCell, parseCaptions, sameOffsets } from "./cellLayout";

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
