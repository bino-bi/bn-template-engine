/** Most decimals a label gets: a double has about 15 significant digits. */
const MAX_DECIMALS = 15;
/** A typed step that gives more ticks than this is not used: the labels would cover each other. */
const MAX_FIXED_TICKS = 50;

/**
 * Linear numeric scale with nice-tick generation for the XY charts.
 *
 * Domains default to the data extent padded 4% on each side; zero-inclusion
 * is NOT forced - points encode by position, not length, so IBCS's
 * zero-baseline rule for bars does not apply. Explicit `min`/`max`
 * overrides disable the padding on that side.
 */
export class NumericScale {
  constructor(
    public readonly domainMin: number,
    public readonly domainMax: number,
    public readonly rangeMin: number,
    public readonly rangeMax: number,
  ) {}

  /** Maps a domain value to range (pixel) coordinates. */
  public scale(value: number): number {
    const span = this.domainMax - this.domainMin;
    if (span === 0) {
      return (this.rangeMin + this.rangeMax) / 2;
    }
    return this.rangeMin + ((value - this.domainMin) / span) * (this.rangeMax - this.rangeMin);
  }

  /**
   * Computes the domain from a data extent: 4% padding on each side,
   * overridden per side by explicit `min`/`max`. Degenerate extents
   * (single value) are widened symmetrically.
   */
  public static domain(
    dataMin: number,
    dataMax: number,
    override?: { min?: number; max?: number },
    pad: number = 0.04,
  ): [number, number] {
    let span = dataMax - dataMin;
    if (span === 0) {
      const widen = dataMin === 0 ? 1 : Math.abs(dataMin) * 0.1;
      dataMin -= widen;
      dataMax += widen;
      span = dataMax - dataMin;
    }

    const min = override?.min !== undefined ? override.min : dataMin - span * pad;
    const max = override?.max !== undefined ? override.max : dataMax + span * pad;
    return [min, max];
  }

  /**
   * Picks a nice step size from the 1-2-2.5-5 ladder so that the span
   * yields close to `targetCount` ticks.
   */
  public static niceStep(span: number, targetCount: number): number {
    if (span <= 0 || targetCount <= 0) {
      return 1;
    }
    const rawStep = span / targetCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;

    let mantissa: number;
    if (normalized <= 1) {
      mantissa = 1;
    } else if (normalized <= 2) {
      mantissa = 2;
    } else if (normalized <= 2.5) {
      mantissa = 2.5;
    } else if (normalized <= 5) {
      mantissa = 5;
    } else {
      mantissa = 10;
    }
    return mantissa * magnitude;
  }

  /**
   * Nice tick values inside the domain, aiming for `targetCount` ticks
   * (the renderer picks 4-8 depending on panel size). A `fixedStep` replaces
   * the nice step, unless it gives more than MAX_FIXED_TICKS ticks.
   */
  public ticks(targetCount: number, fixedStep?: number): number[] {
    const span = this.domainMax - this.domainMin;
    if (span <= 0) {
      return [this.domainMin];
    }

    const step =
      fixedStep !== undefined && fixedStep > 0 && span / fixedStep <= MAX_FIXED_TICKS
        ? fixedStep
        : NumericScale.niceStep(span, targetCount);
    const first = Math.ceil(this.domainMin / step) * step;
    // One tick when a second one cannot be told from the first: the span is below the float
    // resolution of its values, or the step is finer than the decimals a label can show.
    if (first + step === first || step < Math.pow(10, -MAX_DECIMALS)) {
      return [this.domainMin];
    }

    const decimals = NumericScale.stepDecimals(step);
    // Guard against floating-point drift at the domain edge.
    const count = Math.floor((this.domainMax + step * 1e-9 - first) / step) + 1;
    const ticks: number[] = [];
    for (let index = 0; index < count; index++) {
      // rounded to the decimals of the step: 3 * 0.2 is 0.6000000000000001
      const rounded = Number((first + index * step).toFixed(decimals));
      const tick = rounded === 0 ? 0 : rounded;
      // values that differ by float noise only can round two ticks to the same number
      if (ticks.length === 0 || tick !== ticks[ticks.length - 1]) {
        ticks.push(tick);
      }
    }
    return ticks;
  }

  /**
   * Decimal places needed to print multiples of `step` without rounding two of them
   * to the same text: 0.025 needs 3, 2.5 needs 1, 10 needs 0.
   */
  public static stepDecimals(step: number): number {
    if (!Number.isFinite(step) || step <= 0) {
      return 0;
    }
    for (let decimals = 0; decimals < MAX_DECIMALS; decimals++) {
      const scaled = step * Math.pow(10, decimals);
      const whole = Math.round(scaled);
      // a whole number of at least 1, up to float noise
      if (whole >= 1 && Math.abs(scaled - whole) < whole * 1e-9) {
        return decimals;
      }
    }
    return MAX_DECIMALS;
  }

  /**
   * Decimal places needed to render the given ticks without ambiguity between
   * adjacent values: the decimals of their distance, for one tick those of its value.
   */
  public static tickDecimals(ticks: number[]): number {
    if (ticks.length === 0) {
      return 0;
    }
    if (ticks.length === 1) {
      return NumericScale.stepDecimals(Math.abs(ticks[0]));
    }
    return NumericScale.stepDecimals((ticks[ticks.length - 1] - ticks[0]) / (ticks.length - 1));
  }
}
