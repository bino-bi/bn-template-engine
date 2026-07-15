/**
 * Linear numeric scale with nice-tick generation for the XY charts.
 *
 * Domains default to the data extent padded 4% on each side; zero-inclusion
 * is NOT forced — points encode by position, not length, so IBCS's
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
   * (the renderer picks 4–8 depending on panel size).
   */
  public ticks(targetCount: number): number[] {
    const span = this.domainMax - this.domainMin;
    if (span <= 0) {
      return [this.domainMin];
    }

    const step = NumericScale.niceStep(span, targetCount);
    const first = Math.ceil(this.domainMin / step) * step;
    const ticks: number[] = [];
    // Guard against floating-point drift at the domain edge.
    for (let tick = first; tick <= this.domainMax + step * 1e-9; tick += step) {
      ticks.push(Math.abs(tick) < step * 1e-9 ? 0 : tick);
    }
    return ticks;
  }

  /**
   * Decimal places (0–2) needed to render the given ticks without
   * ambiguity between adjacent values.
   */
  public static tickDecimals(ticks: number[]): number {
    let decimals = 0;
    for (const tick of ticks) {
      const text = String(tick);
      const dot = text.indexOf(".");
      if (dot >= 0) {
        decimals = Math.max(decimals, Math.min(2, text.length - dot - 1));
      }
    }
    return decimals;
  }
}
