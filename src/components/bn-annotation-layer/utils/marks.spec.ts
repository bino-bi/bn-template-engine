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
  it("puts a marker with its number on the centre of a data point", () => {
    const mark = buildMark({ target: "t", label: "3" }, "blue", BOX, undefined, EM, false);
    expect(mark).toEqual({ kind: "marker", color: "blue", badge: { cx: 120, cy: 110, r: 7.5, label: "3" } });
  });

  it("puts a marker into the top-right corner of a whole component", () => {
    const mark = buildMark({ target: "t", label: "3" }, "blue", BOX, undefined, EM, true);
    expect(mark).toMatchObject({ kind: "marker", badge: { cx: 132.5, cy: 107.5 } });
  });

  it("draws a smaller dot without a number", () => {
    const mark = buildMark({ target: "t" }, "blue", BOX, undefined, EM, false);
    expect(mark).toMatchObject({ kind: "marker", badge: { r: 4 } });
  });

  it("draws a frame with some padding and the number on its corner", () => {
    const mark = buildMark({ target: "t", mark: "frame", label: "1" }, "blue", BOX, undefined, EM, false);
    expect(mark).toMatchObject({
      kind: "frame",
      x: 98,
      y: 98,
      width: 44,
      height: 24,
      badge: { cx: 142, cy: 98, label: "1" },
    });
  });

  it("draws a frame without a badge when it has no number", () => {
    const mark = buildMark({ target: "t", mark: "frame" }, "blue", BOX, undefined, EM, false);
    expect(mark).toMatchObject({ kind: "frame", badge: undefined });
  });

  it("draws an arrow between the edges of two boxes, with the tip on the second", () => {
    const to = { x: 300, y: 100, width: 40, height: 20 };
    const mark = buildMark({ target: "t", mark: "arrow", label: "2" }, "red", BOX, to, EM, false);
    expect(mark).toMatchObject({ kind: "arrow", x1: 140, y1: 110, x2: 292, y2: 110, badge: { cx: 140, cy: 110 } });
    expect(mark && mark.kind === "arrow" && mark.head.split(" ")[0]).toBe("300,110");
  });

  it("runs an arrow between the centres when the boxes overlap, in the right direction", () => {
    const to = { x: 120, y: 100, width: 40, height: 20 };
    const mark = buildMark({ target: "t", mark: "arrow" }, "red", BOX, to, EM, false);
    expect(mark).toMatchObject({ kind: "arrow", x1: 120, y1: 110, x2: 132, y2: 110 });
    expect(mark && mark.kind === "arrow" && mark.head.split(" ")[0]).toBe("140,110");
  });

  it("keeps a frame and its number inside the layer", () => {
    const whole = { x: 0, y: 0, width: 200, height: 100 };
    const mark = buildMark({ target: "t", mark: "frame", label: "1" }, "blue", whole, undefined, EM, true, {
      width: 200,
      height: 100,
    });
    expect(mark).toMatchObject({ x: 1, y: 1, width: 198, height: 98, badge: { cx: 193.5, cy: 6.5 } });
  });

  it("draws no arrow without a second box or between two boxes with the same centre", () => {
    expect(buildMark({ target: "t", mark: "arrow" }, "red", BOX, undefined, EM, false)).toBeUndefined();
    expect(buildMark({ target: "t", mark: "arrow" }, "red", BOX, BOX, EM, false)).toBeUndefined();
  });
});
