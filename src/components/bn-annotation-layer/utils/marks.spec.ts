import { boxEdge, buildDifference, buildMark } from "./marks";

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
      expect(at(both)).toMatchObject({ cx: 138, cy: 110, r: 4 });
    });

    it("stays at its number when a side has no neighbour on the line", () => {
      const left = { x: 90, y: 102, width: 18, height: 16 };
      const nextRow = { x: 136, y: 118, width: 300, height: 16 };
      const mark = buildMark(item, BOX, undefined, EM, {
        text: TEXT,
        obstacles: [left, { ...nextRow, y: 112 }],
        area: { width: 1000, height: 500 },
      }) as { badge: { cx: number } };
      expect(mark.badge.cx).toBeLessThan(134 + 2 * (6.5 + 2.5));
    });

    it("scales with the font of a small table", () => {
      const small = { x: 110, y: 102, width: 12, height: 6.5 };
      const mark = buildMark(item, BOX, undefined, EM, { text: small }) as { badge: { r: number } };
      expect(mark.badge.r).toBeCloseTo(0.65 * 5);
    });
  });

  describe("marker on a table row", () => {
    const row = { x: 0, y: 100, width: 200, height: 20 };

    it("sits in the middle of the row when that is free", () => {
      const mark = buildMark({ target: "t", label: "1" }, row, undefined, EM, {
        obstacles: [{ x: 170, y: 102, width: 24, height: 16 }],
      });
      expect(mark).toMatchObject({ badge: { cx: 100, cy: 110, r: 7.5 } });
    });

    it("sits next to the number that is in the middle", () => {
      const number = { x: 90, y: 102, width: 24, height: 16 };
      const mark = buildMark({ target: "t", label: "1" }, row, undefined, EM, { obstacles: [number] });
      expect(mark).toMatchObject({ badge: { cx: 90 - 2.5 - 7.5, cy: 110, r: 7.5 } });
    });

    it("takes its size from the height of the row", () => {
      const small = { ...row, height: 9 };
      const mark = buildMark({ target: "t", label: "1" }, small, undefined, EM, { obstacles: [] });
      expect(mark).toMatchObject({ badge: { r: 4.5 } });
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

describe("buildDifference", () => {
  const from = { x: 100, y: 200, width: 20, height: 300 };
  const to = { x: 140, y: 150, width: 20, height: 350 };

  it("prints to minus from and spans the two levels behind the second value", () => {
    const mark = buildDifference({ target: "t", mark: "difference" }, from, to, 101.9, 114.1, 10);
    expect(mark).toMatchObject({ kind: "difference", color: "positive", text: { value: "+12.2", anchor: "start" } });
    if (mark?.kind !== "difference") throw new Error("no difference");
    expect(mark.bar.y).toBe(150);
    expect(mark.bar.height).toBe(50);
    expect(mark.bar.x).toBeGreaterThan(160);
    expect(mark.lines.map((line) => line.y1)).toEqual([200, 150]);
    expect(mark.frame).toBeUndefined();
  });

  it("adds the relative difference and its frame", () => {
    const mark = buildDifference(
      { target: "t", mark: "difference", percent: true, highlight: true },
      from,
      to,
      101.9,
      114.1,
      10,
    );
    if (mark?.kind !== "difference") throw new Error("no difference");
    expect(mark.text.percent).toBe("(+12%)");
    expect(mark.frame).toBeDefined();
  });

  it("is negative for a lower value, and positive again with good-down", () => {
    const lower = buildDifference({ target: "t", mark: "difference" }, from, to, 101.9, 94.9, 10);
    expect(lower).toMatchObject({ color: "negative", text: { value: "-7.0" } });
    const goodDown = buildDifference(
      { target: "t", mark: "difference", sentiment: "good-down", digits: 0 },
      from,
      to,
      101.9,
      94.9,
      10,
    );
    expect(goodDown).toMatchObject({ color: "positive", text: { value: "-7" } });
  });

  it("stands at the left when the second value is left of the first", () => {
    const mark = buildDifference({ target: "t", mark: "difference" }, to, from, 114.1, 101.9, 10);
    if (mark?.kind !== "difference") throw new Error("no difference");
    expect(mark.text.anchor).toBe("end");
    expect(mark.bar.x).toBeLessThan(100);
  });

  it("draws nothing without two values", () => {
    expect(buildDifference({ target: "t", mark: "difference" }, from, to, undefined, 1, 10)).toBeUndefined();
  });
});

describe("frame with its own text", () => {
  it("goes around the text in the upper part of the target", () => {
    const box = { x: 100, y: 100, width: 40, height: 300 };
    const mark = buildMark({ target: "t", mark: "frame", text: "61%" }, box, undefined, 10);
    if (mark?.kind !== "frame") throw new Error("no frame");
    expect(mark.caption).toEqual({ x: 120, y: 190, text: "61%" });
    expect(mark.y).toBeLessThan(190);
    expect(mark.y + mark.height).toBeGreaterThan(190);
    expect(mark.height).toBeLessThan(30);
  });
});

describe("marker on a stack segment", () => {
  it("sits on the upper right corner", () => {
    const box = { x: 100, y: 100, width: 40, height: 80 };
    const mark = buildMark({ target: "t", label: "1" }, box, undefined, 10, { stacked: true });
    if (mark?.kind !== "marker") throw new Error("no marker");
    expect(mark.badge.cx).toBe(140);
    expect(mark.badge.cy).toBeLessThan(110);
  });
});
