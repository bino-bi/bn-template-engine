import { markTreatment, mixHex, resolveSeriesColor, shade, tint, XY_SERIES_PALETTE } from "./SeriesPalette";

describe("SeriesPalette", () => {
  describe("mixHex", () => {
    it("mixes channels linearly in sRGB", () => {
      expect(mixHex("#000000", "#ffffff", 0.6)).toBe("#999999");
      expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
      expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    });

    it("tints with 60% white", () => {
      expect(tint("#404040")).toBe(mixHex("#404040", "#ffffff", 0.6));
    });

    it("shades with 25% black", () => {
      expect(shade("#f07d00")).toBe(mixHex("#f07d00", "#000000", 0.25));
    });
  });

  describe("resolveSeriesColor", () => {
    it("assigns palette colors by index without overflow", () => {
      const { color, overflowed } = resolveSeriesColor(0, XY_SERIES_PALETTE);
      expect(color).toBe(XY_SERIES_PALETTE[0]);
      expect(overflowed).toBe(false);
    });

    it("cycles with a tint step past the palette end and flags the overflow", () => {
      const { color, overflowed } = resolveSeriesColor(XY_SERIES_PALETTE.length, XY_SERIES_PALETTE);
      expect(color).toBe(tint(XY_SERIES_PALETTE[0]));
      expect(overflowed).toBe(true);
    });

    it("falls back to the default palette when the override list is empty", () => {
      expect(resolveSeriesColor(1, []).color).toBe(XY_SERIES_PALETTE[1]);
    });
  });

  describe("markTreatment (§6.1 table)", () => {
    const hue = "#f07d00";

    it("colorIndex 10 (ac): solid series hue", () => {
      const bubble = markTreatment(10, hue, "bubble");
      expect(bubble.fill).toBe(hue);
      expect(bubble.stroke).toBe("#ffffff");
      expect(bubble.strokeWidth).toBe(1);

      const dot = markTreatment(10, hue, "dot");
      expect(dot.fill).toBe(hue);
      expect(dot.strokeWidth).toBe(0.75);
    });

    it("colorIndex 20 (pp/py): tinted fill — computed color, not opacity", () => {
      const treatment = markTreatment(20, hue, "bubble");
      expect(treatment.fill).toBe(tint(hue));
      expect(treatment.fill).not.toBe(hue);
    });

    it("colorIndex 30 (fc): bubble hatches, dot gets a dashed ring", () => {
      const bubble = markTreatment(30, hue, "bubble");
      expect(bubble.hatch).toBe(true);
      expect(bubble.fill).toBe("#ffffff");
      expect(bubble.stroke).toBe(hue);

      const dot = markTreatment(30, hue, "dot");
      expect(dot.hatch).toBeUndefined();
      expect(dot.dasharray).toBeDefined();
      expect(dot.fill).toBe("#ffffff");
      expect(dot.stroke).toBe(hue);
    });

    it("colorIndex 50 (pl/bu): white fill with solid hue ring", () => {
      const treatment = markTreatment(50, hue, "dot");
      expect(treatment.fill).toBe("#ffffff");
      expect(treatment.stroke).toBe(hue);
      expect(treatment.dasharray).toBeUndefined();
    });

    it("unknown color indices fall back to the solid treatment", () => {
      expect(markTreatment(99, hue, "bubble").fill).toBe(hue);
    });
  });
});
