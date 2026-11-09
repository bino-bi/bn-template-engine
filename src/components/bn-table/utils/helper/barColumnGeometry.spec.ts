import { absoluteBarGeometry, relativePinGeometry, waterfallGeometry } from "./barColumnGeometry";

/**
 * `bar-column-width="wN"` and `category-width="wN"` must render the same width.
 * `.category-wN` sets a border-box of `N em` (bn-table-renderer.scss:50-83); a bar cell is
 * sized by its SVG plus `0.5em` of padding (bn-table-renderer.scss:320), so the SVG has to
 * come out at `(N - 0.5) em`.
 */
const EM = 20; // round number: keeps every expectation exact
const cellPadding = EM * 0.5;
const contentWidth = (n: number) => n * EM - cellPadding;

describe("barColumnGeometry", () => {
  describe("column width parity with .category-wN", () => {
    const presets = [5, 10, 15, 20, 25, 30, 100];

    it.each(presets)("absolute bars fill exactly w%i minus the cell padding", (n) => {
      for (const [hasNeg, hasPos] of [
        [true, true],
        [true, false],
        [false, true],
      ]) {
        expect(absoluteBarGeometry(n, EM, hasNeg, hasPos).totalWidth).toBeCloseTo(contentWidth(n), 6);
      }
    });

    it.each(presets)("relative pins fill exactly w%i minus the cell padding", (n) => {
      expect(relativePinGeometry(n, EM, true, true).totalWidth).toBeCloseTo(contentWidth(n), 6);
      expect(relativePinGeometry(n, EM, false, true).totalWidth).toBeCloseTo(contentWidth(n), 6);
    });

    it.each(presets)("waterfalls fill exactly w%i minus the cell padding", (n) => {
      expect(waterfallGeometry(n, EM).totalWidth).toBeCloseTo(contentWidth(n), 6);
    });
  });

  describe("absoluteBarGeometry", () => {
    it("splits a two-sided w15 column into two gutters and two equal bar areas", () => {
      const g = absoluteBarGeometry(15, EM, true, true);

      expect(g.totalWidth).toBe(290);
      expect(g.labelAreaWidth).toBe(57); // 2.85em
      expect(g.maxBarWidth).toBe(88); // (290 - 2 x 57) / 2
      expect(g.breakGap).toBe(6); // 0.3em
      expect(g.overdriveZoneWidth).toBeCloseTo(13.2, 6); // 15% of the bar extent
      expect(g.cutWidth).toBeCloseTo(68.8, 6);
      expect(g.labelGap).toBe(6);
    });

    it("centres the axis when the column carries both signs", () => {
      const g = absoluteBarGeometry(15, EM, true, true);
      expect(g.axisX).toBe(g.totalWidth / 2);
    });

    it("gives a one-sided column the whole bar area and pins the axis to the edge", () => {
      const pos = absoluteBarGeometry(15, EM, false, true);
      expect(pos.maxBarWidth).toBe(233); // 290 - 57
      expect(pos.axisX).toBe(0);

      const neg = absoluteBarGeometry(15, EM, true, false);
      expect(neg.maxBarWidth).toBe(233);
      expect(neg.axisX).toBe(neg.totalWidth);
    });

    it("partitions the column exactly across gutters and bar areas", () => {
      for (const [hasNeg, hasPos, sides] of [
        [true, true, 2],
        [false, true, 1],
      ] as [boolean, boolean, number][]) {
        const g = absoluteBarGeometry(15, EM, hasNeg, hasPos);
        expect(g.maxBarWidth * sides + g.labelAreaWidth * sides).toBeCloseTo(g.totalWidth, 6);
      }
    });

    it("shrinks the gutters rather than the column when w5 cannot fit them", () => {
      const g = absoluteBarGeometry(5, EM, true, true);

      expect(g.totalWidth).toBe(90); // still exactly w5 minus padding
      expect(g.labelAreaWidth).toBe(22.5); // clamped down from 57
      expect(g.maxBarWidth).toBe(22.5); // bars keep half the column
      expect(g.breakGap).toBe(4.5); // clamped down from 6
      expect(g.cutWidth).toBeCloseTo(14.625, 6);
    });

    it("keeps a drawable bar area at every preset", () => {
      for (const n of [5, 10, 15, 100]) {
        const g = absoluteBarGeometry(n, EM, true, true);
        expect(g.maxBarWidth).toBeGreaterThan(0);
        expect(g.cutWidth).toBeGreaterThan(0);
      }
    });
  });

  describe("relativePinGeometry", () => {
    it("splits a two-sided w15 column into two gutters and two equal pin areas", () => {
      const g = relativePinGeometry(15, EM, true, true);

      expect(g.totalWidth).toBe(290);
      expect(g.labelAreaWidth).toBe(67.5); // 3.375em
      expect(g.pinPadding).toBe(7.5); // 0.375em
      expect(g.maxPinLength).toBe(70); // (290 - 2 x 67.5) / 2 - 7.5
      expect(g.axisX).toBe(145); // left gutter + left pin area
      expect(g.labelGap).toBe(6); // 0.3em
    });

    it("gives a one-sided column the whole pin area", () => {
      const g = relativePinGeometry(15, EM, false, true);
      expect(g.maxPinLength).toBe(215); // 290 - 67.5 - 7.5
      expect(g.axisX).toBe(0);
    });

    it("puts the gutter of a negative-only column on the left", () => {
      const g = relativePinGeometry(15, EM, true, false);
      expect(g.maxPinLength).toBe(215);
      expect(g.axisX).toBe(290); // 67.5 + 222.5
    });

    it("keeps a drawable pin at w5", () => {
      const g = relativePinGeometry(5, EM, true, true);
      expect(g.totalWidth).toBe(90);
      expect(g.labelAreaWidth).toBe(22.5); // clamped down from 67.5
      expect(g.maxPinLength).toBeGreaterThan(0);
    });
  });

  describe("waterfallGeometry", () => {
    it("reserves a gutter on both sides", () => {
      const g = waterfallGeometry(15, EM);

      expect(g.totalWidth).toBe(290);
      expect(g.labelAreaWidth).toBe(57);
      expect(g.barAreaWidth).toBe(176); // 290 - 2 x 57
      expect(g.labelGap).toBe(6);
    });

    it("shrinks the gutters rather than the column at w5", () => {
      const g = waterfallGeometry(5, EM);
      expect(g.totalWidth).toBe(90);
      expect(g.labelAreaWidth).toBe(22.5);
      expect(g.barAreaWidth).toBe(45);
    });
  });

  describe("pixel constants carried over from the old geometry", () => {
    // The em values were derived by dividing the old hardcoded px by the 13.3333 px base.
    const BASE = 13.3333;

    it("reproduces the historic label gutters and gaps", () => {
      const bar = absoluteBarGeometry(30, BASE, true, true);
      expect(bar.labelAreaWidth).toBeCloseTo(38, 3);
      expect(bar.breakGap).toBeCloseTo(4, 3);
      expect(bar.labelGap).toBeCloseTo(4, 3);

      const pin = relativePinGeometry(30, BASE, true, true);
      expect(pin.labelAreaWidth).toBeCloseTo(45, 3);
      expect(pin.pinPadding).toBeCloseTo(5, 3);
    });
  });
});
