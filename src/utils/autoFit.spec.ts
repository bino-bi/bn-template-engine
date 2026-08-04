import { computePercentBarExtent, computeUnitBarExtent, MIN_PIXEL_SCALE, solveAutoFitStep } from "./autoFit";

describe("computeUnitBarExtent", () => {
  it("returns the positive max for all-positive data", () => {
    expect(computeUnitBarExtent({ relativeVariance: false, maxPositive: 159, minNegative: 0 })).toBe(159);
  });

  it("counts BOTH sides of the axis for mixed-sign data", () => {
    // The sandbox regression: variance -13..+12 spans 25 units, not 12.
    // Solving with only the positive side made pixelPerUnit ~2x too large
    // and the chart overshot its container by ~180px.
    expect(computeUnitBarExtent({ relativeVariance: false, maxPositive: 12, minNegative: -13 })).toBe(25);
  });

  it("returns the magnitude for all-negative data", () => {
    expect(computeUnitBarExtent({ relativeVariance: false, maxPositive: 0, minNegative: -42 })).toBe(42);
  });

  it("returns 0 for relative variances (they scale with pixelPerPercentage)", () => {
    expect(computeUnitBarExtent({ relativeVariance: true, maxPositive: 0.5, minNegative: -0.2 })).toBe(0);
  });

  it("uses the fixed domain for stacked charts, ignoring min/max", () => {
    expect(computeUnitBarExtent({ fixedDomain: 300, relativeVariance: false, maxPositive: 90, minNegative: -10 })).toBe(
      300,
    );
  });

  it("uses the relative-stack span as fixed domain", () => {
    // structure: 1 * ppu; time: RELATIVE_STACK_UNITS * ppu
    expect(computeUnitBarExtent({ fixedDomain: 1, relativeVariance: false, maxPositive: 90, minNegative: 0 })).toBe(1);
    expect(computeUnitBarExtent({ fixedDomain: 100, relativeVariance: false, maxPositive: 90, minNegative: 0 })).toBe(
      100,
    );
  });

  it("never returns a negative extent", () => {
    expect(computeUnitBarExtent({ fixedDomain: -5, relativeVariance: false, maxPositive: 0, minNegative: 0 })).toBe(0);
    expect(computeUnitBarExtent({ relativeVariance: false, maxPositive: -3, minNegative: 2 })).toBe(0);
  });
});

describe("computePercentBarExtent", () => {
  it("returns 0 for non-relative variances", () => {
    expect(computePercentBarExtent({ relativeVariance: false, maxPositive: 0.8, minNegative: -0.3 })).toBe(0);
  });

  it("sums both sides for relative variances", () => {
    expect(computePercentBarExtent({ relativeVariance: true, maxPositive: 0.3, minNegative: -0.3 })).toBeCloseTo(0.6);
  });

  it("clamps each side at +/-145% (clipped needles render as arrows)", () => {
    expect(computePercentBarExtent({ relativeVariance: true, maxPositive: 2.0, minNegative: -0.5 })).toBeCloseTo(1.95);
    expect(computePercentBarExtent({ relativeVariance: true, maxPositive: 2.0, minNegative: -3.0 })).toBeCloseTo(2.9);
  });
});

describe("solveAutoFitStep", () => {
  it("solves the affine model exactly", () => {
    // measured = fixed(100) + extent(25) * ppu(1) = 125; target 600
    const step = solveAutoFitStep({
      target: 600,
      measured: 125,
      unitExtent: 25,
      pctExtent: 0,
      currentPpu: 1,
      currentPpp: 1,
    });
    expect(step.ppu).toBeCloseTo(20); // (600 - 100) / 25
    expect(step.ppp).toBeUndefined();
  });

  it("solves the percentage path exactly", () => {
    // measured = fixed(50) + extent(1.95) * ppp(1) = 51.95; target 245
    const step = solveAutoFitStep({
      target: 245,
      measured: 51.95,
      unitExtent: 0,
      pctExtent: 1.95,
      currentPpu: 1,
      currentPpp: 1,
    });
    expect(step.ppu).toBeUndefined();
    expect(step.ppp).toBeCloseTo(100); // (245 - 50) / 1.95
  });

  it("floors at MIN_PIXEL_SCALE when the fixed parts alone exceed the target", () => {
    const step = solveAutoFitStep({
      target: 100,
      measured: 300,
      unitExtent: 10,
      pctExtent: 0,
      currentPpu: 1,
      currentPpp: 1,
    });
    expect(step.ppu).toBe(MIN_PIXEL_SCALE);
  });

  it("returns an empty result when nothing scales", () => {
    expect(
      solveAutoFitStep({ target: 100, measured: 300, unitExtent: 0, pctExtent: 0, currentPpu: 1, currentPpp: 1 }),
    ).toEqual({ ppu: undefined, ppp: undefined });
  });

  it("re-solves correctly from a non-1 current value", () => {
    // measured = fixed(80) + 25 * 4 = 180 at ppu 4; target 330 -> ppu 10
    const step = solveAutoFitStep({
      target: 330,
      measured: 180,
      unitExtent: 25,
      pctExtent: 0,
      currentPpu: 4,
      currentPpp: 1,
    });
    expect(step.ppu).toBeCloseTo(10);
  });

  it("converges within 3 corrections on a piecewise width model with clamp flips", () => {
    // Width model mimicking StructureChart: each side clamps to a title
    // length, and half-title paddings latch on when a side is small. The
    // clamp releases as ppu grows, so "fixed" changes between passes.
    const TITLE = 60;
    const pos = 12;
    const neg = 13;
    const width = (ppu: number) => {
      const left = Math.max(TITLE, neg * ppu + 20);
      const right = Math.max(TITLE, pos * ppu + 25);
      let total = left + right + 10;
      if (left < TITLE / 2) total += TITLE / 2;
      if (right < TITLE / 2) total += TITLE / 2;
      return total;
    };
    const extent = pos + neg;
    const target = 512;

    let ppu = 1;
    let measured = width(ppu);
    let fitting: number | null = null;
    for (let i = 0; i <= 3; i++) {
      const step = solveAutoFitStep({
        target,
        measured,
        unitExtent: extent,
        pctExtent: 0,
        currentPpu: ppu,
        currentPpp: 1,
      });
      if (step.ppu === undefined) break;
      ppu = step.ppu;
      measured = width(ppu);
      if (measured <= target + 0.5) {
        fitting = ppu;
        if (measured >= target * 0.98) break;
      }
    }
    expect(fitting).not.toBeNull();
    expect(width(fitting!)).toBeLessThanOrEqual(target + 0.5);
    expect(width(fitting!)).toBeGreaterThanOrEqual(target * 0.9);
  });
});
