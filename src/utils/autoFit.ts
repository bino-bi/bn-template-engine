/**
 * Pure math for the chart auto-fit loops (ibcs-chart-structure fits width,
 * ibcs-chart-time fits height). Kept free of chart/svg.js imports so it can
 * be unit-tested under mock-doc (which lacks getBBox).
 *
 * Model: a chart's size along its fit axis is affine in the pixel scales,
 *   measured = fixed + unitExtent * pixelPerUnit + pctExtent * pixelPerPercentage
 * where the extents are the total bar lengths in data units (positive plus
 * negative side of the axis). The chart classes report their extents via
 * getUnitBarExtent()/getPercentBarExtent(); {@link solveAutoFitStep} solves
 * the model for the target size against a fresh measurement, so repeated
 * steps converge even when clamped label widths flip between passes.
 */

/** Lower bound for auto-fitted pixelPerUnit / pixelPerPercentage values. */
export const MIN_PIXEL_SCALE = 0.001;

/** Inputs describing which data extent scales with pixelPerUnit. */
export interface UnitExtentInputs {
  /**
   * When set, the bar domain is fixed and overrides the data-driven extent:
   * stacked charts use their stacked total (or the relative-stack span),
   * regardless of individual min/max values.
   */
  fixedDomain?: number;
  /** True when the chart renders a relative (percentage) variance. */
  relativeVariance: boolean;
  /** Highest data value on the positive side of the axis (or 0). */
  maxPositive: number;
  /** Smallest data value on the negative side of the axis (or 0). */
  minNegative: number;
}

/**
 * Total bar extent (in data units) that scales linearly with pixelPerUnit.
 * Counts BOTH sides of the axis — a chart with values -13..+12 spans 25
 * units, not 12 (fitting only the positive side is how charts used to
 * overshoot their container).
 */
export function computeUnitBarExtent(inputs: UnitExtentInputs): number {
  if (inputs.fixedDomain != null) {
    return Math.max(0, inputs.fixedDomain);
  }
  if (inputs.relativeVariance) {
    return 0; // relative variance bars scale with pixelPerPercentage instead
  }
  return Math.max(0, inputs.maxPositive) + Math.abs(Math.min(0, inputs.minNegative));
}

/** Inputs describing which data extent scales with pixelPerPercentage. */
export interface PercentExtentInputs {
  /** True when the chart renders a relative (percentage) variance. */
  relativeVariance: boolean;
  /** Highest variance fraction on the positive side (0.12 = +12%). */
  maxPositive: number;
  /** Smallest variance fraction on the negative side (-0.05 = -5%). */
  minNegative: number;
  /** Per-side clamp in fraction units (IBCS pins beyond ±145% -> 1.45). */
  sideClamp?: number;
}

/**
 * Total bar extent (in fraction units) that scales linearly with
 * pixelPerPercentage. Only relative variances use it; each side is clamped
 * because extreme pins render as fixed-size arrows instead of longer bars.
 */
export function computePercentBarExtent(inputs: PercentExtentInputs): number {
  if (!inputs.relativeVariance) {
    return 0;
  }
  const clamp = inputs.sideClamp ?? 1.45;
  const positive = Math.min(clamp, Math.max(0, inputs.maxPositive));
  const negative = Math.min(clamp, Math.abs(Math.min(0, inputs.minNegative)));
  return positive + negative;
}

/** One verify-and-correct step against a fresh chart measurement. */
export interface AutoFitStepInputs {
  /** Available size along the fit axis (width or height) in px. */
  target: number;
  /** Rendered chart size along the fit axis at the current scales, in px. */
  measured: number;
  /** Unit extent being solved, or 0 when pixelPerUnit is explicit. */
  unitExtent: number;
  /** Percent extent being solved, or 0 when pixelPerPercentage is explicit. */
  pctExtent: number;
  /** pixelPerUnit the measurement was rendered with. */
  currentPpu: number;
  /** pixelPerPercentage the measurement was rendered with. */
  currentPpp: number;
}

/**
 * Solves the affine size model for the target and returns corrected scale
 * values (floored at {@link MIN_PIXEL_SCALE}). Returns an empty object when
 * nothing scales with the solved values (both extents 0) — callers fall back
 * to a ratio heuristic. Only the quantities whose extent is > 0 are returned.
 */
export function solveAutoFitStep(inputs: AutoFitStepInputs): { ppu?: number; ppp?: number } {
  const divisor = inputs.unitExtent + inputs.pctExtent;
  if (divisor <= 0) {
    return {};
  }
  const fixed = inputs.measured - inputs.unitExtent * inputs.currentPpu - inputs.pctExtent * inputs.currentPpp;
  const solved = Math.max(MIN_PIXEL_SCALE, (inputs.target - fixed) / divisor);
  return {
    ppu: inputs.unitExtent > 0 ? solved : undefined,
    ppp: inputs.pctExtent > 0 ? solved : undefined,
  };
}
