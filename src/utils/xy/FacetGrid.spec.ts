import { FacetGrid } from "./FacetGrid";

const AREA = { x: 100, y: 50, width: 940, height: 460 };

describe("FacetGrid", () => {
  it("lays all panels in one row by default", () => {
    const grid = new FacetGrid(3, undefined, AREA, 20);
    expect(grid.columns).toBe(3);
    expect(grid.rows).toBe(1);
  });

  it("wraps row-major at the column count", () => {
    const grid = new FacetGrid(5, 3, AREA, 20);
    expect(grid.columns).toBe(3);
    expect(grid.rows).toBe(2);

    const first = grid.panelRect(0);
    const fourth = grid.panelRect(3);
    expect(fourth.x).toBe(first.x);
    expect(fourth.y).toBeGreaterThan(first.y);
  });

  it("produces equal panel sizes with gaps between them", () => {
    const grid = new FacetGrid(4, 2, AREA, 20);
    const a = grid.panelRect(0);
    const b = grid.panelRect(1);
    const c = grid.panelRect(2);

    expect(a.width).toBeCloseTo(b.width);
    expect(a.height).toBeCloseTo(c.height);
    expect(b.x - (a.x + a.width)).toBeCloseTo(20);
    expect(c.y - (a.y + a.height)).toBeCloseTo(20);
    expect(a.x).toBe(AREA.x);
    expect(a.y).toBe(AREA.y);
  });

  it("fills the drawing area exactly", () => {
    const grid = new FacetGrid(4, 2, AREA, 20);
    const last = grid.panelRect(3);
    expect(last.x + last.width).toBeCloseTo(AREA.x + AREA.width);
    expect(last.y + last.height).toBeCloseTo(AREA.y + AREA.height);
  });

  it("flags outer-left panels (they carry y tick labels)", () => {
    const grid = new FacetGrid(6, 3, AREA, 20);
    expect(grid.isOuterLeft(0)).toBe(true);
    expect(grid.isOuterLeft(3)).toBe(true);
    expect(grid.isOuterLeft(1)).toBe(false);
    expect(grid.isOuterLeft(5)).toBe(false);
  });

  it("flags outer-bottom panels including ragged last rows", () => {
    const grid = new FacetGrid(5, 3, AREA, 20);
    expect(grid.isOuterBottom(3)).toBe(true);
    expect(grid.isOuterBottom(4)).toBe(true);
    // Panel 2 has no panel below it (the second row has only 2 panels).
    expect(grid.isOuterBottom(2)).toBe(true);
    expect(grid.isOuterBottom(0)).toBe(false);
    expect(grid.isOuterBottom(1)).toBe(false);
  });

  it("clamps the column count to the panel count", () => {
    const grid = new FacetGrid(2, 6, AREA, 20);
    expect(grid.columns).toBe(2);
  });
});

describe("FacetGrid neighbours in a row", () => {
  it("tells which panels have one to the left and to the right", () => {
    const grid = new FacetGrid(5, 3, { x: 0, y: 0, width: 900, height: 400 }, 20);
    expect([0, 1, 2, 3, 4].map((i) => grid.hasLeftNeighbour(i))).toEqual([false, true, true, false, true]);
    // the last row is not full: panel 4 is its last one
    expect([0, 1, 2, 3, 4].map((i) => grid.hasRightNeighbour(i))).toEqual([true, true, false, true, false]);
  });
});
