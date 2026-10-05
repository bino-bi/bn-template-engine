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

    it("uses two decimals for .25 steps", () => {
      expect(NumericScale.tickDecimals([0, 0.25, 0.5])).toBe(2);
    });

    it("takes the decimals from the step, not from float noise", () => {
      expect(NumericScale.tickDecimals([0, 0.2, 0.4, 0.6000000000000001, 0.8])).toBe(1);
    });

    it("has no cap: steps of 0.005 need three decimals", () => {
      expect(NumericScale.tickDecimals([0.02, 0.025, 0.03])).toBe(3);
    });

    it("takes the decimals of the value for a single tick", () => {
      expect(NumericScale.tickDecimals([3.7])).toBe(1);
      expect(NumericScale.tickDecimals([0])).toBe(0);
      expect(NumericScale.tickDecimals([])).toBe(0);
    });
  });

  describe("stepDecimals", () => {
    it.each([
      [10, 0],
      [1, 0],
      [2.5, 1],
      [0.2, 1],
      [0.25, 2],
      [0.025, 3],
      [0.0025, 4],
      [0.00005, 5],
      [0.30000000000000004, 1],
    ])("needs for a step of %d %d decimals", (step, decimals) => {
      expect(NumericScale.stepDecimals(step)).toBe(decimals);
    });

    it("needs many decimals for a very small step", () => {
      // the tolerance for float noise must not take these steps for 0
      expect(NumericScale.stepDecimals(1e-10)).toBe(10);
      expect(NumericScale.stepDecimals(5e-13)).toBe(13);
    });

    it("needs no decimals for a step that is not a positive number", () => {
      expect(NumericScale.stepDecimals(0)).toBe(0);
      expect(NumericScale.stepDecimals(NaN)).toBe(0);
    });
  });

  describe("ticks and their labels", () => {
    const labels = (min: number, max: number, target: number): string[] => {
      const ticks = new NumericScale(min, max, 0, 500).ticks(target);
      const decimals = NumericScale.tickDecimals(ticks);
      return ticks.map((tick) => tick.toFixed(decimals));
    };

    it("prints every tick of a 0.025 step differently", () => {
      expect(labels(0.02, 0.145, 5)).toEqual(["0.025", "0.050", "0.075", "0.100", "0.125"]);
    });

    it("prints every tick of a 0.0025 step differently", () => {
      expect(labels(0, 0.0125, 5)).toEqual(["0.0000", "0.0025", "0.0050", "0.0075", "0.0100", "0.0125"]);
    });

    it("prints every tick of a 0.005 step differently", () => {
      // was 0.02 | 0.03 | 0.03 | 0.04 | 0.04 | 0.05
      expect(labels(0.02, 0.045, 5)).toEqual(["0.020", "0.025", "0.030", "0.035", "0.040", "0.045"]);
    });

    it("gives ticks without float noise", () => {
      expect(new NumericScale(0, 1, 0, 500).ticks(5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
      expect(labels(0, 1, 5)).toEqual(["0.0", "0.2", "0.4", "0.6", "0.8", "1.0"]);
    });

    it.each([
      [0, 2e-9],
      [0.1, 0.1000000001],
      [1234.56, 1234.5600000000013],
    ])("keeps the ticks of the very small domain %d to %d apart and inside it", (min, max) => {
      const ticks = new NumericScale(min, max, 0, 500).ticks(5);

      expect(ticks.length).toBeGreaterThan(1);
      expect(new Set(ticks).size).toBe(ticks.length);
      for (const tick of ticks) {
        // they all were one whole number far outside the domain
        expect(tick).toBeGreaterThanOrEqual(min);
        expect(tick).toBeLessThanOrEqual(max + (max - min) * 1e-6);
      }
    });

    it("keeps the ticks of a step that needs exactly 15 decimals", () => {
      expect(new NumericScale(0, 1e-13, 0, 500).ticks(4)).toEqual([0, 2.5e-14, 5e-14, 7.5e-14, 1e-13]);
    });

    it.each([
      [870.68, 870.6800000000006, 7],
      [56.55, 56.550000000000054, 6],
    ])("gives no tick twice when the values %d and %d differ by float noise", (min, max, target) => {
      const ticks = new NumericScale(min, max, 0, 500).ticks(target);

      expect(ticks.length).toBeGreaterThan(0);
      expect(new Set(ticks).size).toBe(ticks.length);
    });

    it.each([
      [0, 3e-18],
      [-5.55e-17, 2.78e-17],
    ])("gives one tick when the step %d to %d is finer than a label can show", (min, max) => {
      // several ticks would all print 0,000000000000000
      expect(new NumericScale(min, max, 0, 500).ticks(5)).toEqual([min]);
    });

    it.each([
      [1e9, 1e9 + 2.4e-7],
      [1e16, 1e16 + 4],
    ])("returns for a domain below the float resolution: %d to %d", (min, max) => {
      expect(new NumericScale(min, max, 0, 500).ticks(5)).toEqual([min]);
    });
  });
});
