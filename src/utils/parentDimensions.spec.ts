import { getClippedHeight } from "./parentDimensions";

interface FakeElement {
  overflowY: string;
  parentElement: FakeElement | null;
  assignedSlot: null;
  offsetWidth: number;
  offsetHeight: number;
  clientHeight: number;
  scrollHeight: number;
  getBoundingClientRect(): { top: number; bottom: number; width: number; height: number };
  getRootNode(): object;
}

interface BoxOptions {
  parent?: FakeElement | null;
  /** Screen px per layout px: a transform somewhere above the box. */
  scale?: number;
  /** Layout size when it is not the screen size divided by `scale`. */
  layout?: { width: number; height: number };
  /** Height of the content when it is more than the box shows: the box can scroll. */
  scrollHeight?: number;
}

/** A box 200 px wide on the screen from `top` to `bottom`, with the given overflow. */
const box = (top: number, bottom: number, overflowY: string, options: BoxOptions = {}): FakeElement => {
  const scale = options.scale ?? 1;
  return {
    overflowY,
    parentElement: options.parent ?? null,
    assignedSlot: null,
    offsetWidth: options.layout?.width ?? 200 / scale,
    offsetHeight: options.layout?.height ?? (bottom - top) / scale,
    clientHeight: (bottom - top) / scale,
    scrollHeight: options.scrollHeight ?? (bottom - top) / scale,
    getBoundingClientRect: () => ({ top, bottom, width: 200, height: bottom - top }),
    getRootNode: () => ({}),
  };
};

const clipped = (element: FakeElement, contentHeight: number): number =>
  getClippedHeight(element as unknown as HTMLElement, contentHeight);

describe("getClippedHeight", () => {
  const original = (global as any).getComputedStyle;

  beforeAll(() => {
    (global as any).getComputedStyle = (element: FakeElement) => ({ overflowY: element.overflowY });
  });

  afterAll(() => {
    (global as any).getComputedStyle = original;
  });

  it("is 0 when no ancestor clips, however small the window is", () => {
    const page = box(0, 600, "visible");
    const section = box(20, 720, "visible", { parent: page });

    expect(clipped(box(20, 720, "visible", { parent: section }), 700)).toBe(0);
  });

  it("is the part below a cell that hides its overflow", () => {
    const cell = box(100, 400, "hidden", { parent: box(0, 1000, "visible") });

    // the content runs from 100 to 670, the cell ends at 400
    expect(clipped(box(100, 670, "visible", { parent: cell }), 570)).toBe(270);
  });

  it("is 0 when the cell that hides its overflow has grown with the content", () => {
    const cell = box(100, 673, "hidden", { parent: box(0, 1000, "visible") });

    expect(clipped(box(100, 670, "visible", { parent: cell }), 570)).toBe(0);
  });

  it("takes the ancestor that cuts off the most", () => {
    const outer = box(0, 300, "clip");
    const inner = box(100, 500, "hidden", { parent: outer });

    expect(clipped(box(100, 670, "visible", { parent: inner }), 570)).toBe(370);
  });

  it("counts the element itself when it has a fixed height and hides its overflow", () => {
    expect(clipped(box(100, 400, "hidden", { parent: box(0, 1000, "visible") }), 570)).toBe(270);
  });

  it("is 0 below the fold of a scroll container, also inside a shell that hides its overflow", () => {
    // the second page of an app: the window is 700 px high, the page starts at 800
    const shell = box(0, 700, "hidden");
    const outlet = box(0, 700, "auto", { parent: shell, scrollHeight: 1600 });
    const cell = box(800, 1527, "hidden", { parent: outlet });

    expect(clipped(box(800, 1140, "hidden", { parent: cell }), 340)).toBe(0);
  });

  it("still counts a cell inside a scroll container", () => {
    const outlet = box(0, 700, "auto", { parent: box(0, 700, "hidden"), scrollHeight: 1600 });
    const cell = box(800, 1000, "hidden", { parent: outlet });

    expect(clipped(box(800, 1140, "visible", { parent: cell }), 340)).toBe(140);
  });

  it("looks past a wrapper with overflow auto that does not scroll", () => {
    // overflow-x: auto gives overflow-y auto too, but the wrapper is as high as its content
    const cell = box(0, 300, "hidden");
    const wrapper = box(0, 479, "auto", { parent: cell });

    expect(clipped(box(0, 475, "hidden", { parent: wrapper }), 475)).toBe(175);
  });

  it("is 0 for a chart that fits a page which is scaled down to fit the window", () => {
    // 340 layout px shown at 70 %: 238 px on the screen
    const cell = box(100, 609, "hidden", { scale: 0.7 });

    expect(clipped(box(100, 338, "hidden", { parent: cell, scale: 0.7 }), 340)).toBeCloseTo(0);
  });

  it("measures the cut in layout px on a page that is scaled up", () => {
    // a 200 px cell and a chart of 277 px, both shown at 200 %
    const cell = box(100, 500, "hidden", { scale: 2 });

    expect(clipped(box(100, 654, "visible", { parent: cell, scale: 2 }), 277)).toBeCloseTo(77);
  });

  it("is 0 for an element without a box", () => {
    const hidden = box(0, 0, "hidden", { parent: box(0, 0, "visible"), layout: { width: 0, height: 0 } });

    expect(clipped(hidden, 101)).toBe(0);
  });

  it("is 0 under a rotation, where width and height swap on the screen", () => {
    // 800 x 200 layout px, turned by 90 degrees: 200 px wide and 800 px high on the screen
    const rotated = box(0, 800, "hidden", { layout: { width: 800, height: 200 } });

    expect(clipped(rotated, 424)).toBe(0);
  });
});
