import { IsoCurves } from "./IsoCurves";
import { NumericScale } from "./NumericScale";

const FRAME = { x: 0, y: 0, width: 1000, height: 600 };

const scales = (xMin: number, xMax: number, yMin: number, yMax: number) => ({
  x: new NumericScale(xMin, xMax, FRAME.x, FRAME.x + FRAME.width),
  y: new NumericScale(yMin, yMax, FRAME.y + FRAME.height, FRAME.y),
});

describe("IsoCurves", () => {
  describe("domain guard", () => {
    it("accepts axes that start at 0 or above", () => {
      expect(IsoCurves.isDrawable([1, 35], [1, 35])).toBe(true);
      expect(IsoCurves.isDrawable([0, 35], [0, 35])).toBe(true);
    });

    it("rejects an axis that goes below 0 or ends at 0", () => {
      expect(IsoCurves.isDrawable([1, 35], [-5, 35])).toBe(false);
      expect(IsoCurves.isDrawable([-1, 35], [0, 35])).toBe(false);
      expect(IsoCurves.isDrawable([0, 0], [0, 35])).toBe(false);
    });
  });

  describe("axes from 0", () => {
    const { x, y } = scales(0, 35, 0, 35);
    const iso = new IsoCurves(x, y);

    it("draws the curve from the top edge to the right edge", () => {
      const path = iso.path(100)!;
      const points = path
        .split(/[ML]/)
        .filter(Boolean)
        .map((p) => p.trim().split(" ").map(Number));
      // x = k / yMax at the top, y = k / xMax at the right
      expect(points[0][0]).toBeCloseTo(x.scale(100 / 35));
      expect(points[0][1]).toBeCloseTo(y.scale(35));
      expect(points[points.length - 1][0]).toBeCloseTo(x.scale(35));
      expect(points[points.length - 1][1]).toBeCloseTo(y.scale(100 / 35));
      expect(iso.exitPoint(100)).toMatchObject({ edge: "right" });
    });

    it("shades the region above the curve and not the whole frame", () => {
      const region = iso.regionPath(100)!;
      expect(region.startsWith(`M ${x.scale(100 / 35)} ${y.scale(35)}`)).toBe(true);
      expect(region.endsWith(`L ${x.scale(35)} ${y.scale(35)} Z`)).toBe(true);
    });

    it("has no curve below 0", () => {
      const negative = scales(-5, 35, 0, 35);
      expect(new IsoCurves(negative.x, negative.y).path(100)).toBeNull();
      expect(new IsoCurves(negative.x, negative.y).regionPath(100)).toBeNull();
    });
  });

  describe("autoK", () => {
    const LADDER = (value: number): boolean => {
      const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
      return [1, 2, 5].some((m) => Math.abs(value / magnitude - m) < 1e-9);
    };

    it("picks 2-4 nice values from the 1-2-5 ladder", () => {
      const products = Array.from({ length: 100 }, (_, i) => 0.5 + i * 0.35);
      const ks = IsoCurves.autoK(products);
      expect(ks.length).toBeGreaterThanOrEqual(2);
      expect(ks.length).toBeLessThanOrEqual(4);
      for (const k of ks) {
        expect(LADDER(k)).toBe(true);
      }
    });

    it("spans the central product range", () => {
      const products = Array.from({ length: 100 }, (_, i) => 1 + i);
      const ks = IsoCurves.autoK(products);
      for (const k of ks) {
        expect(k).toBeGreaterThanOrEqual(1);
        expect(k).toBeLessThanOrEqual(100);
      }
    });

    it("returns an empty list for non-positive products", () => {
      expect(IsoCurves.autoK([-3, 0])).toEqual([]);
      expect(IsoCurves.autoK([])).toEqual([]);
    });
  });

  describe("path", () => {
    it("returns a path clipped to the frame", () => {
      const { x, y } = scales(1, 35, 1, 35);
      const iso = new IsoCurves(x, y);
      const path = iso.path(100);
      expect(path).not.toBeNull();

      const coordinates = path!
        .split(/[ML]\s*/)
        .filter((s) => s.trim() !== "")
        .map((pair) => pair.trim().split(/\s+/).map(Number));
      for (const [px, py] of coordinates) {
        expect(px).toBeGreaterThanOrEqual(FRAME.x - 1e-6);
        expect(px).toBeLessThanOrEqual(FRAME.x + FRAME.width + 1e-6);
        expect(py).toBeGreaterThanOrEqual(FRAME.y - 1e-6);
        expect(py).toBeLessThanOrEqual(FRAME.y + FRAME.height + 1e-6);
      }
    });

    it("returns null for curves outside the frame", () => {
      const { x, y } = scales(1, 10, 1, 10);
      const iso = new IsoCurves(x, y);
      expect(iso.path(1000)).toBeNull();
    });

    it("returns null on a domain below 0", () => {
      const { x, y } = scales(-1, 10, 1, 10);
      expect(new IsoCurves(x, y).path(5)).toBeNull();
    });
  });

  describe("exitPoint", () => {
    it("exits at the right edge when the curve reaches xMax", () => {
      const { x, y } = scales(1, 35, 1, 35);
      const exit = new IsoCurves(x, y).exitPoint(100)!;
      expect(exit.edge).toBe("right");
      expect(exit.x).toBeCloseTo(FRAME.x + FRAME.width);
    });

    it("exits at the bottom edge when the curve reaches yMin first", () => {
      const { x, y } = scales(1, 1000, 1, 35);
      const exit = new IsoCurves(x, y).exitPoint(100)!;
      expect(exit.edge).toBe("bottom");
      expect(exit.y).toBeCloseTo(FRAME.y + FRAME.height);
    });
  });

  describe("regionPath", () => {
    it("shades the full frame when the whole domain satisfies x·y >= k", () => {
      const { x, y } = scales(10, 35, 10, 35);
      const region = new IsoCurves(x, y).regionPath(50)!;
      expect(region).toContain("M 0 0");
      expect(region).toContain("Z");
    });

    it("returns null when no part of the domain satisfies x·y >= k", () => {
      const { x, y } = scales(1, 10, 1, 10);
      expect(new IsoCurves(x, y).regionPath(1000)).toBeNull();
    });

    it("builds a closed region enclosing the top-right corner", () => {
      const { x, y } = scales(1, 35, 1, 35);
      const region = new IsoCurves(x, y).regionPath(100)!;
      expect(region).toContain(`L ${FRAME.x + FRAME.width} ${FRAME.y}`);
      expect(region.endsWith("Z")).toBe(true);
    });
  });
});
