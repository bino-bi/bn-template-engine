import { ComponentLayoutState, DualRect, LayoutElement, TableRowInfo } from "../../../utils/layoutState/types";
import { isWholeComponent, matchPoint, MatchedPoint } from "./matchPoint";

const rect = (x: number): DualRect => ({
  context: { x, y: 0, width: 1, height: 1 },
  component: { x, y: 0, width: 1, height: 1 },
});

const state = (elements: LayoutElement[], rows?: TableRowInfo[]): ComponentLayoutState =>
  ({ elements, table: rows ? { rows, columns: [] } : undefined }) as unknown as ComponentLayoutState;

const bar = (x: number, point: Record<string, string>): LayoutElement =>
  ({ kind: "bar", segment: "base", index: 0, rect: rect(x), point: { part: "element", ...point } }) as LayoutElement;

const CHART = state([
  bar(1, { date: "2024-01-01", scenario: "ac1" }),
  bar(2, { date: "2024-01-01", scenario: "pl1" }),
  bar(3, { date: "2024-01-01", scenario: "ac1", part: "label" }),
  bar(4, { date: "2025-01-01", part: "total" }),
]);

const xs = (found: MatchedPoint[]) => found.map((match) => match.rect.component.x);

describe("matchPoint", () => {
  it("needs every given field to be equal", () => {
    expect(xs(matchPoint(CHART, { date: "2024-01-01", scenario: "pl1" }))).toEqual([2]);
    expect(xs(matchPoint(CHART, { date: "2024-01-01", scenario: "xx" }))).toEqual([]);
  });

  it("takes a field left out as a wildcard", () => {
    expect(xs(matchPoint(CHART, { date: "2024-01-01" }))).toEqual([1, 2]);
  });

  it("looks at the element unless the point names another part", () => {
    expect(xs(matchPoint(CHART, { date: "2024-01-01", scenario: "ac1" }))).toEqual([1]);
    expect(xs(matchPoint(CHART, { date: "2024-01-01", scenario: "ac1", part: "label" }))).toEqual([3]);
    expect(xs(matchPoint(CHART, { date: "2025-01-01", part: "total" }))).toEqual([4]);
  });

  it("keeps subCategory a wildcard in a chart", () => {
    const stacked = state([bar(1, { category: "A", subCategory: "X", scenario: "ac1" })]);
    expect(xs(matchPoint(stacked, { category: "A", scenario: "ac1" }))).toEqual([1]);
  });

  it("gives the box of the text of a cell", () => {
    const cell = { ...bar(1, { category: "A", scenario: "ac1" }), content: rect(7) } as LayoutElement;
    expect(matchPoint(state([cell]), { category: "A", scenario: "ac1" })[0].content).toEqual(rect(7));
  });

  it("skips elements without a key", () => {
    const axis = { kind: "axis", orientation: "horizontal", rect: rect(9) } as LayoutElement;
    expect(matchPoint(state([axis]), { date: "2024-01-01" })).toEqual([]);
  });

  it("compares a number in the point with the text of the attribute", () => {
    const found = matchPoint(state([bar(1, { category: "2024" })]), { category: 2024 as unknown as string });
    expect(xs(found)).toEqual([1]);
  });

  describe("on a table", () => {
    const row = (x: number, point?: Record<string, string>): TableRowInfo => ({
      section: "body",
      index: 0,
      type: "STANDARD",
      rect: rect(x),
      point: point && { part: "element", ...point },
    });
    const TABLE = state(
      [bar(1, { category: "A", scenario: "ac1" }), bar(2, { category: "A", scenario: "pl1" })],
      [row(10, { category: "A" }), row(11, { category: "B" }), row(12, { row: "total" }), row(13)],
    );

    it("takes a point with a scenario as a cell", () => {
      expect(xs(matchPoint(TABLE, { category: "A", scenario: "pl1" }))).toEqual([2]);
    });

    it("takes a point without a subCategory as the parent of its thereof rows", () => {
      const thereof = state(
        [
          bar(1, { category: "A", scenario: "ac1" }),
          bar(2, { category: "A", subCategory: "X", scenario: "ac1" }),
          bar(3, { category: "A", subCategory: "Y", scenario: "ac1" }),
        ],
        [row(10, { category: "A" }), row(11, { category: "A", subCategory: "X" })],
      );

      expect(xs(matchPoint(thereof, { category: "A" }))).toEqual([10]);
      expect(xs(matchPoint(thereof, { category: "A", scenario: "ac1" }))).toEqual([1]);
      expect(xs(matchPoint(thereof, { category: "A", subCategory: "X" }))).toEqual([11]);
      expect(xs(matchPoint(thereof, { category: "A", subCategory: "Y", scenario: "ac1" }))).toEqual([3]);
    });

    it("does not fall back to a thereof row when the parent does not match", () => {
      const thereof = state(
        [],
        [row(10, { category: "A" }), row(11, { rowGroup: "E", category: "A", subCategory: "X" })],
      );
      expect(xs(matchPoint(thereof, { rowGroup: "E", category: "A" }))).toEqual([]);
    });

    it("takes a point without a scenario as the whole row", () => {
      expect(xs(matchPoint(TABLE, { category: "A" }))).toEqual([10]);
      expect(xs(matchPoint(TABLE, { row: "total" }))).toEqual([12]);
    });
  });
});

describe("isWholeComponent", () => {
  it("is true without a field", () => {
    expect(isWholeComponent(undefined)).toBe(true);
    expect(isWholeComponent({})).toBe(true);
  });

  it("is false with any field", () => {
    expect(isWholeComponent({ category: "A" })).toBe(false);
    expect(isWholeComponent({ part: "total" })).toBe(false);
  });
});
