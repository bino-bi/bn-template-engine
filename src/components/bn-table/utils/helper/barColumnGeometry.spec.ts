import {
  absoluteBarGeometry,
  estimateLabelWidth,
  pinLabelsFit,
  relativePinGeometry,
  waterfallGeometry,
} from "./barColumnGeometry";

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
  // widest label per side: 40 px on the left, 50 px on the right
  const BOTH = { neg: 40, pos: 50 };
  const HEAD = 10;

  describe("column width parity with .category-wN", () => {
    const presets = [5, 10, 15, 20, 25, 30, 100];

    it.each(presets)("absolute bars fill exactly w%i minus the cell padding", (n) => {
      for (const labels of [BOTH, { neg: 40 }, { pos: 50 }]) {
        expect(absoluteBarGeometry(n, EM, labels).totalWidth).toBeCloseTo(contentWidth(n), 6);
      }
    });

    it.each(presets)("relative pins fill exactly w%i minus the cell padding", (n) => {
      expect(relativePinGeometry(n, EM, BOTH, HEAD).totalWidth).toBeCloseTo(contentWidth(n), 6);
      expect(relativePinGeometry(n, EM, { pos: 50 }, HEAD).totalWidth).toBeCloseTo(contentWidth(n), 6);
    });

    it.each(presets)("waterfalls fill exactly w%i minus the cell padding", (n) => {
      expect(waterfallGeometry(n, EM).totalWidth).toBeCloseTo(contentWidth(n), 6);
    });
  });

  describe("estimateLabelWidth", () => {
    it("adds the glyph widths of the label font and a 10% margin", () => {
      // 5 x 0.59 for the sign and the digits, 0.28 for the point, 0.89 for the percent sign
      expect(estimateLabelWidth("+36.21%", 10)).toBeCloseTo(41.2 * 1.1, 6);
      expect(estimateLabelWidth("-27.3%", 10)).toBeCloseTo((0.34 * 10 + 3 * 5.9 + 2.8 + 8.9) * 1.1, 6);
    });

    // advance widths in em from the font files
    const ARIAL: Record<string, number> = { "+": 0.584, "-": 0.333, ".": 0.278, "%": 0.889, digit: 0.556 };
    const DEJAVU_SANS: Record<string, number> = { "+": 0.838, "-": 0.361, ".": 0.318, "%": 0.95, digit: 0.636 };
    const realWidth = (font: Record<string, number>, text: string) =>
      [...text].reduce((em, char) => em + (font[char] ?? font.digit), 0);
    const LABELS = ["+36.21%", "-27.3%", "+100%", "-0.5%", "+8"];
    // the cell padding is 0.25 table em, i.e. 0.25 / 0.85 label em
    const PADDING = 0.25 / 0.85;

    it.each(LABELS)("is not narrower than %s in Arial", (text) => {
      expect(estimateLabelWidth(text, 1)).toBeGreaterThanOrEqual(realWidth(ARIAL, text));
    });

    it.each(LABELS)("leaves %s in the DejaVu Sans fallback inside the cell padding", (text) => {
      expect(estimateLabelWidth(text, 1) + PADDING).toBeGreaterThanOrEqual(realWidth(DEJAVU_SANS, text));
    });

    it("is wider for a longer label", () => {
      expect(estimateLabelWidth("+1,234", 10)).toBeGreaterThan(estimateLabelWidth("+234", 10));
    });
  });

  describe("absoluteBarGeometry", () => {
    it("reserves per side the widest label, the gap and the half axis, the rest is bar", () => {
      const g = absoluteBarGeometry(15, EM, BOTH);

      expect(g.totalWidth).toBe(290);
      // left 2.5 + 6 + 40 = 48.5, right 2.5 + 6 + 50 = 58.5
      expect(g.maxBarWidth).toBeCloseTo(91.5, 6); // (290 - 48.5 - 58.5) / 2
      expect(g.axisX).toBeCloseTo(140, 6); // 48.5 + 91.5
      expect(g.breakGap).toBe(6); // 0.3em
      expect(g.overdriveZoneWidth).toBeCloseTo(13.725, 6); // 15% of the bar extent
      expect(g.cutWidth).toBeCloseTo(71.775, 6);
      expect(g.labelGap).toBe(6);
    });

    it("leaves room for the widest label after the longest bar on both sides", () => {
      const g = absoluteBarGeometry(15, EM, BOTH);
      const halfAxis = 2.5;

      expect(g.axisX + halfAxis + g.maxBarWidth + g.labelGap + BOTH.pos).toBeCloseTo(g.totalWidth, 6);
      expect(g.axisX - halfAxis - g.maxBarWidth - g.labelGap - BOTH.neg).toBeCloseTo(0, 6);
    });

    it("gives a one-sided column the whole bar area and pins the axis to the edge", () => {
      const pos = absoluteBarGeometry(15, EM, { pos: 50 });
      expect(pos.maxBarWidth).toBeCloseTo(231.5, 6); // 290 - 58.5
      expect(pos.axisX).toBe(0);

      const neg = absoluteBarGeometry(15, EM, { neg: 50 });
      expect(neg.maxBarWidth).toBeCloseTo(231.5, 6);
      expect(neg.axisX).toBe(neg.totalWidth);
    });

    it("treats a column without drawn values as positive only", () => {
      expect(absoluteBarGeometry(15, EM, {}).axisX).toBe(0);
    });

    it("shortens the bars before the labels when w5 cannot fit both", () => {
      const g = absoluteBarGeometry(5, EM, { neg: 30, pos: 30 });

      expect(g.totalWidth).toBe(90); // still exactly w5 minus padding
      // 2.5 + 6 + 30 = 38.5 per side, the bars get the 13 px left
      expect(g.maxBarWidth).toBeCloseTo(6.5, 6);
      expect(g.axisX).toBeCloseTo(45, 6);
      expect(g.axisX - 2.5 - g.maxBarWidth - g.labelGap - 30).toBeCloseTo(0, 6);
    });

    it("shrinks the reserves only when the labels alone do not fit", () => {
      const g = absoluteBarGeometry(5, EM, { neg: 100, pos: 100 });

      expect(g.totalWidth).toBe(90);
      expect(g.maxBarWidth).toBe(0);
      expect(g.axisX).toBeCloseTo(45, 6);
    });

    it("keeps a drawable bar area at every preset", () => {
      for (const n of [5, 10, 15, 100]) {
        const g = absoluteBarGeometry(n, EM, { neg: 20, pos: 25 });
        expect(g.maxBarWidth).toBeGreaterThan(0);
        expect(g.cutWidth).toBeGreaterThan(0);
      }
    });
  });

  describe("relativePinGeometry", () => {
    it("reserves per side the half head, the gap and the widest label, the rest is pin", () => {
      const g = relativePinGeometry(15, EM, BOTH, HEAD);

      expect(g.totalWidth).toBe(290);
      // left 5 + 6 + 40 = 51, right 5 + 6 + 50 = 61
      expect(g.maxPinLength).toBeCloseTo(89, 6); // (290 - 51 - 61) / 2
      expect(g.axisX).toBeCloseTo(140, 6); // 51 + 89
      expect(g.labelGap).toBe(6); // 0.3em
    });

    it("lets the longest pin, its head and its label exactly fill each side", () => {
      const g = relativePinGeometry(15, EM, BOTH, HEAD);

      expect(g.axisX + g.maxPinLength + HEAD / 2 + g.labelGap + BOTH.pos).toBeCloseTo(g.totalWidth, 6);
      expect(g.axisX - g.maxPinLength - HEAD / 2 - g.labelGap - BOTH.neg).toBeCloseTo(0, 6);
    });

    it("gives a one-sided column the whole pin area", () => {
      const g = relativePinGeometry(15, EM, { pos: 50 }, HEAD);
      expect(g.maxPinLength).toBeCloseTo(229, 6); // 290 - 61
      expect(g.axisX).toBe(0);
    });

    it("puts the gutter of a negative-only column on the left", () => {
      const g = relativePinGeometry(15, EM, { neg: 50 }, HEAD);
      expect(g.maxPinLength).toBeCloseTo(229, 6);
      expect(g.axisX).toBe(290); // 61 + 229
    });

    it("shortens the pins before the labels at w5", () => {
      const g = relativePinGeometry(5, EM, { neg: 30, pos: 30 }, HEAD);
      expect(g.totalWidth).toBe(90);
      // 5 + 6 + 30 = 41 per side, the pins get the 8 px left
      expect(g.maxPinLength).toBeCloseTo(4, 6);
      expect(g.axisX - g.maxPinLength - HEAD / 2 - g.labelGap - 30).toBeCloseTo(0, 6);
    });
  });

  describe("pinLabelsFit", () => {
    it("is true while the labels leave 1em of pin per side", () => {
      expect(pinLabelsFit(15, EM, BOTH, HEAD)).toBe(true);
      // 51 + 61 + 2 x 20 = 152 of 190
      expect(pinLabelsFit(10, EM, BOTH, HEAD)).toBe(true);
    });

    it("is false when the pins would get less than 1em", () => {
      // 41 + 41 + 2 x 20 = 122 of 90
      expect(pinLabelsFit(5, EM, { neg: 30, pos: 30 }, HEAD)).toBe(false);
      // a one-sided column needs one pin only: 41 + 20 = 61 of 90
      expect(pinLabelsFit(5, EM, { pos: 30 }, HEAD)).toBe(true);
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

    it("reproduces the historic gaps", () => {
      const bar = absoluteBarGeometry(30, BASE, BOTH);
      expect(bar.breakGap).toBeCloseTo(4, 3);
      expect(bar.labelGap).toBeCloseTo(4, 3);
      expect(waterfallGeometry(30, BASE).labelAreaWidth).toBeCloseTo(38, 3);
    });
  });
});
