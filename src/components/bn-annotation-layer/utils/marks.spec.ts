import { boxEdge, buildMark } from "./marks";

const BOX = { x: 100, y: 100, width: 40, height: 20 };
const EM = 10;

describe("boxEdge", () => {
  it("leaves through the side the line crosses", () => {
    expect(boxEdge(BOX, { x: 220, y: 110 })).toEqual({ x: 140, y: 110 });
    expect(boxEdge(BOX, { x: 120, y: 0 })).toEqual({ x: 120, y: 100 });
  });

  it("follows the line for a diagonal", () => {
    // from the centre (120, 110) towards (160, 150): the bottom side comes first
    expect(boxEdge(BOX, { x: 160, y: 150 })).toEqual({ x: 130, y: 120 });
  });

  it("stays in the centre when there is no direction", () => {
    expect(boxEdge(BOX, { x: 120, y: 110 })).toEqual({ x: 120, y: 110 });
  });
});

describe("buildMark", () => {
  const TEXT = { x: 110, y: 102, width: 24, height: 16 };

  it("puts a marker with its number on the centre of a data point", () => {
    const mark = buildMark({ target: "t", label: "3", color: "negative" }, BOX, undefined, EM);
    expect(mark).toEqual({ kind: "marker", color: "negative", badge: { cx: 120, cy: 110, r: 7.5, label: "3" } });
  });

  it("puts a marker into the top-right corner of a whole component", () => {
    const mark = buildMark({ target: "t", label: "3" }, BOX, undefined, EM, { whole: true });
    expect(mark).toMatchObject({ kind: "marker", badge: { cx: 132.5, cy: 107.5 } });
  });

  it("draws a smaller dot without a number", () => {
    const mark = buildMark({ target: "t" }, BOX, undefined, EM);
    expect(mark).toMatchObject({ kind: "marker", badge: { r: 4 } });
  });

  describe("marker on a table cell", () => {
    const item = { target: "t", label: "6" };
    const at = (obstacles: { x: number; y: number; width: number; height: number }[], area?: object) =>
      (buildMark(item, BOX, undefined, EM, { text: TEXT, obstacles, area: area as never }) as { badge: object }).badge;

    it("sits left of the number, not on it", () => {
      expect(at([])).toMatchObject({ cx: 110 - 2.5 - 6.5, cy: 110, r: 6.5 });
    });

    it("sits right of the number when another number is on the left", () => {
      expect(at([{ x: 90, y: 102, width: 18, height: 16 }])).toMatchObject({ cx: 134 + 2.5 + 6.5, cy: 110 });
    });

    it("sits right of the number when the left is outside of the layer", () => {
      expect(at([], { width: 500, height: 500 })).toMatchObject({ cx: 101 });
      const nearEdge = { ...TEXT, x: 4 };
      const mark = buildMark(item, BOX, undefined, EM, { text: nearEdge, area: { width: 500, height: 500 } });
      expect(mark).toMatchObject({ badge: { cx: 28 + 2.5 + 6.5 } });
    });

    it("gets smaller and sits in the wider gap when both sides are taken", () => {
      const both = [
        { x: 90, y: 102, width: 18, height: 16 },
        { x: 142, y: 102, width: 18, height: 16 },
      ];
      // gaps of 2 px on the left and 8 px on the right of the number
      expect(at(both)).toMatchObject({ cx: 138, cy: 110, r: 5 });
    });
  });

  describe("frame", () => {
    it("is an oval around the text of a cell, not around the cell", () => {
      const mark = buildMark({ target: "t", mark: "frame" }, BOX, undefined, EM, { text: TEXT });
      // centred on the text, 4.5 px wider and 1 px higher on each side
      expect(mark).toMatchObject({ kind: "frame", x: 105.5, y: 101, width: 33, height: 18, rx: 14.4, ry: 9 });
    });

    it("is an oval around a value label", () => {
      const mark = buildMark({ target: "t", mark: "frame", point: { part: "total" } }, BOX, undefined, EM);
      expect(mark).toMatchObject({ x: 95.5, y: 99, width: 49, height: 22, rx: 17.6, ry: 11 });
    });

    it("gives a single digit a circle", () => {
      const digit = { x: 110, y: 100, width: 8, height: 20 };
      const mark = buildMark({ target: "t", mark: "frame" }, BOX, undefined, EM, { text: digit });
      expect(mark).toMatchObject({ x: 99.5, width: 29, height: 22, ry: 11 });
    });

    it("has round ends around a bar, with the sides straight", () => {
      const bar = { x: 100, y: 50, width: 20, height: 200 };
      const mark = buildMark({ target: "t", mark: "frame", point: { category: "A" } }, bar, undefined, EM);
      expect(mark).toMatchObject({ x: 98, width: 24, rx: 12, ry: 12 });
    });

    it("keeps its corners around a whole component", () => {
      const mark = buildMark({ target: "t", mark: "frame" }, BOX, undefined, EM, { whole: true });
      expect(mark).toMatchObject({ x: 98, y: 98, width: 44, height: 24, rx: 2.5, ry: 2.5 });
    });

    it("has its number on the outline", () => {
      const mark = buildMark({ target: "t", mark: "frame", label: "1" }, BOX, undefined, EM, { text: TEXT }) as {
        x: number;
        width: number;
        badge: { cx: number; cy: number; label: string };
      };
      expect(mark.badge.label).toBe("1");
      // just outside of the outline, to not hide the text
      expect(mark.badge.cx).toBeCloseTo(138.5 - 14.4 * (1 - Math.SQRT1_2) + 3.9);
      expect(mark.badge.cy).toBeCloseTo(101 + 9 * (1 - Math.SQRT1_2) - 3.9);
    });

    it("has no badge without a number", () => {
      const mark = buildMark({ target: "t", mark: "frame" }, BOX, undefined, EM);
      expect(mark).toMatchObject({ kind: "frame", badge: undefined });
    });

    it("stays inside the layer", () => {
      const whole = { x: 0, y: 0, width: 200, height: 100 };
      const mark = buildMark({ target: "t", mark: "frame", label: "1" }, whole, undefined, EM, {
        whole: true,
        area: { width: 200, height: 100 },
      });
      expect(mark).toMatchObject({ x: 1, y: 1, width: 198, height: 98, badge: { cx: 193.5, cy: 6.5 } });
    });
  });

  it("draws an arrow between the edges of two boxes, with the tip on the second", () => {
    const to = { x: 300, y: 100, width: 40, height: 20 };
    const mark = buildMark({ target: "t", mark: "arrow", label: "2" }, BOX, to, EM);
    expect(mark).toMatchObject({ kind: "arrow", x1: 140, y1: 110, x2: 292, y2: 110, badge: { cx: 140, cy: 110 } });
    expect(mark && mark.kind === "arrow" && mark.head.split(" ")[0]).toBe("300,110");
  });

  it("runs an arrow between the centres when the boxes overlap, in the right direction", () => {
    const to = { x: 120, y: 100, width: 40, height: 20 };
    const mark = buildMark({ target: "t", mark: "arrow" }, BOX, to, EM);
    expect(mark).toMatchObject({ kind: "arrow", x1: 120, y1: 110, x2: 132, y2: 110 });
    expect(mark && mark.kind === "arrow" && mark.head.split(" ")[0]).toBe("140,110");
  });

  it("draws no arrow without a second box or between two boxes with the same centre", () => {
    expect(buildMark({ target: "t", mark: "arrow" }, BOX, undefined, EM)).toBeUndefined();
    expect(buildMark({ target: "t", mark: "arrow" }, BOX, BOX, EM)).toBeUndefined();
  });
});
