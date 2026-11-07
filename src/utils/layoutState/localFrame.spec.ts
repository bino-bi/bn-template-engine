import { MockDocument } from "@stencil/core/mock-doc";
import { place } from "../testing/place";
import { localFrameOf } from "./localFrame";

/** Enough of DOMMatrix for a 2D `matrix(a, b, c, d, e, f)`. */
class Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  constructor(text: string) {
    [this.a, this.b, this.c, this.d] = text
      .replace(/^matrix\(|\)$/g, "")
      .split(",")
      .map(Number);
  }
}

describe("localFrameOf", () => {
  const original = { getComputedStyle: global.getComputedStyle, DOMMatrix: (global as any).DOMMatrix };
  let transforms: Map<Element, string>;

  beforeEach(() => {
    transforms = new Map();
    (global as any).DOMMatrix = Matrix2D;
    (global as any).getComputedStyle = (el: Element) => ({ transform: transforms.get(el) ?? "none" });
  });

  afterEach(() => {
    (global as any).getComputedStyle = original.getComputedStyle;
    (global as any).DOMMatrix = original.DOMMatrix;
  });

  const build = () => {
    const doc = new MockDocument();
    const page = doc.createElement("div");
    const host = doc.createElement("div");
    page.appendChild(host);
    Object.defineProperty(host, "offsetWidth", { value: 200 });
    Object.defineProperty(host, "offsetHeight", { value: 100 });
    return { page: page as unknown as Element, host: host as unknown as Element };
  };

  it("subtracts the top-left corner on a plain page", () => {
    const { host } = build();
    place(host, { left: 50, top: 60, width: 200, height: 100 });

    expect(localFrameOf(host).toLocal({ left: 70, top: 80, width: 20, height: 5 })).toEqual({
      x: 20,
      y: 20,
      width: 20,
      height: 5,
    });
  });

  it("maps a box on a page turned by -90 degrees back into the page", () => {
    const { page, host } = build();
    transforms.set(page, "matrix(0, -1, 1, 0, 0, 0)");
    // turned: 100 wide and 200 high on screen, the local top-left at the bottom-left
    place(host, { left: 50, top: 60, width: 100, height: 200 });

    // local x 10..30, y 20..25 is screen x 70..75, y 230..250
    expect(localFrameOf(host).toLocal({ left: 70, top: 230, width: 5, height: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 20,
      height: 5,
    });
  });

  it("divides out a scaled page", () => {
    const { page, host } = build();
    transforms.set(page, "matrix(2, 0, 0, 2, 0, 0)");
    place(host, { left: 0, top: 0, width: 400, height: 200 });

    expect(localFrameOf(host).toLocal({ left: 40, top: 20, width: 20, height: 10 })).toEqual({
      x: 20,
      y: 10,
      width: 10,
      height: 5,
    });
  });
});
