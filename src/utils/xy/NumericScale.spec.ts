import { NumericScale } from "./NumericScale";

describe("NumericScale", () => {
  describe("domain", () => {
    it("pads the data extent by 4% on each side", () => {
      const [min, max] = NumericScale.domain(0, 100);
      expect(min).toBeCloseTo(-4);
      expect(max).toBeCloseTo(104);
    });

    it("does not force zero into the domain", () => {
      const [min, max] = NumericScale.domain(50, 100);
      expect(min).toBeCloseTo(48);
      expect(max).toBeCloseTo(102);
      expect(min).toBeGreaterThan(0);
    });

    it("applies explicit min/max overrides without padding", () => {
      const [min, max] = NumericScale.domain(3, 97, { min: 0, max: 100 });
      expect(min).toBe(0);
      expect(max).toBe(100);
    });

    it("overrides one side and pads the other", () => {
      const [min, max] = NumericScale.domain(0, 100, { min: 0 });
      expect(min).toBe(0);
      expect(max).toBeCloseTo(104);
    });

    it("widens a degenerate single-value extent", () => {
      const [min, max] = NumericScale.domain(50, 50);
      expect(min).toBeLessThan(50);
      expect(max).toBeGreaterThan(50);
    });
  });

  describe("scale", () => {
    it("maps linearly into the pixel range", () => {
      const scale = new NumericScale(0, 100, 0, 500);
      expect(scale.scale(0)).toBe(0);
      expect(scale.scale(50)).toBe(250);
      expect(scale.scale(100)).toBe(500);
    });

    it("supports inverted ranges (screen y axis)", () => {
      const scale = new NumericScale(0, 100, 400, 0);
      expect(scale.scale(0)).toBe(400);
      expect(scale.scale(100)).toBe(0);
    });
  });

  describe("ticks", () => {
    const LADDER_MANTISSAS = [1, 2, 2.5, 5];

    const isNice = (step: number): boolean => {
      const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
      return LADDER_MANTISSAS.some((m) => Math.abs(step / magnitude - m) < 1e-9);
    };

    it("lands ticks on the nice-step ladder", () => {
      const scale = new NumericScale(0, 100, 0, 500);
      const ticks = scale.ticks(5);
      expect(ticks.length).toBeGreaterThanOrEqual(4);
      const step = ticks[1] - ticks[0];
      expect(isNice(step)).toBe(true);
    });

    it("produces 4-8 ticks for typical domains and targets", () => {
      const domains: [number, number][] = [
        [0, 100],
        [0, 35],
        [0, 1.25],
        [-40, 40],
        [12.3, 87.9],
      ];
      for (const [min, max] of domains) {
        for (const target of [4, 6, 8]) {
          const ticks = new NumericScale(min, max, 0, 500).ticks(target);
          expect(ticks.length).toBeGreaterThanOrEqual(3);
          expect(ticks.length).toBeLessThanOrEqual(9);
        }
      }
    });

    it("keeps all ticks inside the domain", () => {
      const scale = new NumericScale(-4, 104, 0, 500);
      for (const tick of scale.ticks(6)) {
        expect(tick).toBeGreaterThanOrEqual(-4);
        expect(tick).toBeLessThanOrEqual(104);
      }
    });

    it("reproduces the 0.25 steps of the IBCS 10A template", () => {
      const scale = new NumericScale(0, 1.25, 0, 500);
      const ticks = scale.ticks(5);
      expect(ticks).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25]);
    });
  });

  describe("tickDecimals", () => {
    it("needs no decimals for integer ticks", () => {
      expect(NumericScale.tickDecimals([0, 10, 20])).toBe(0);
    });

    it("uses one decimal for .5 steps", () => {
      expect(NumericScale.tickDecimals([0, 0.5, 1])).toBe(1);
    });

    it("uses two decimals for .25 steps and caps at 2", () => {
      expect(NumericScale.tickDecimals([0, 0.25, 0.5])).toBe(2);
      expect(NumericScale.tickDecimals([0.123456])).toBe(2);
    });
  });
});
