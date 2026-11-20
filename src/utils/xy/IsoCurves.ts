import { NumericScale } from "./NumericScale";

/** Exit point of an iso-curve at the plot frame, in pixel coordinates. */
export interface IsoExitPoint {
  x: number;
  y: number;
  edge: "right" | "bottom";
}

const SAMPLES = 64;

/**
 * Hyperbolic iso-lines `x·y = k` for the scatter chart (IBCS 09C/09D):
 * a third derived measure visualized as thin curves with value labels at
 * the curve's exit edge, optionally shading the region `x·y >= k`.
 *
 * Needs axes that do not go below 0. An axis may start at 0: the curve then
 * runs on to the far edge of the frame.
 */
export class IsoCurves {
  constructor(
    private readonly xScale: NumericScale,
    private readonly yScale: NumericScale,
  ) {}

  /** Iso-curves are drawn in the first quadrant only: no axis may go below 0. */
  public static isDrawable(xDomain: [number, number], yDomain: [number, number]): boolean {
    return xDomain[0] >= 0 && yDomain[0] >= 0 && xDomain[1] > 0 && yDomain[1] > 0;
  }

  private isDrawableDomain(): boolean {
    return IsoCurves.isDrawable(
      [this.xScale.domainMin, this.xScale.domainMax],
      [this.yScale.domainMin, this.yScale.domainMax],
    );
  }

  /**
   * Picks 2-4 nice k values from the 1-2-5 ladder spanning the central
   * product range of the data (products = `x·y` per point).
   */
  public static autoK(products: number[]): number[] {
    const positive = products.filter((p) => p > 0).sort((a, b) => a - b);
    if (positive.length === 0) {
      return [];
    }

    const quantile = (q: number): number => positive[Math.min(positive.length - 1, Math.floor(q * positive.length))];

    let candidates = IsoCurves.ladderValues(quantile(0.25), quantile(0.75));
    if (candidates.length < 2) {
      candidates = IsoCurves.ladderValues(positive[0], positive[positive.length - 1]);
    }
    if (candidates.length === 0) {
      return [];
    }
    if (candidates.length === 1) {
      return candidates;
    }
    if (candidates.length <= 4) {
      return candidates;
    }

    // Evenly spaced subset of 4 across the candidate list.
    const picked: number[] = [];
    for (let i = 0; i < 4; i++) {
      picked.push(candidates[Math.round((i * (candidates.length - 1)) / 3)]);
    }
    return [...new Set(picked)];
  }

  /** All 1-2-5 ladder values within `[min, max]`, ascending. */
  private static ladderValues(min: number, max: number): number[] {
    if (min <= 0 || max < min) {
      return [];
    }
    const values: number[] = [];
    for (let exp = Math.floor(Math.log10(min)) - 1; exp <= Math.ceil(Math.log10(max)); exp++) {
      for (const mantissa of [1, 2, 5]) {
        const value = mantissa * Math.pow(10, exp);
        if (value >= min && value <= max) {
          values.push(value);
        }
      }
    }
    return values;
  }

  /**
   * Domain x-interval where the curve `y = k/x` lies inside the domain
   * rectangle, or `null` when the curve misses it entirely.
   */
  private visibleRange(k: number): [number, number] | null {
    if (!this.isDrawableDomain() || k <= 0) {
      return null;
    }
    const x1 = Math.max(this.xScale.domainMin, k / this.yScale.domainMax);
    // with y from 0 the curve never reaches the lower edge
    const x2 =
      this.yScale.domainMin > 0 ? Math.min(this.xScale.domainMax, k / this.yScale.domainMin) : this.xScale.domainMax;
    if (x1 >= x2) {
      return null;
    }
    return [x1, x2];
  }

  /** Curve sample points in pixel coordinates (geometric x-spacing). */
  private samples(k: number): { x: number; y: number }[] | null {
    const range = this.visibleRange(k);
    if (range === null) {
      return null;
    }
    const [x1, x2] = range;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const x = x1 * Math.pow(x2 / x1, i / (SAMPLES - 1));
      points.push({ x: this.xScale.scale(x), y: this.yScale.scale(k / x) });
    }
    return points;
  }

  /** SVG path of the curve clipped to the frame, or `null` when invisible. */
  public path(k: number): string | null {
    const points = this.samples(k);
    if (points === null) {
      return null;
    }
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }

  /** Where the curve leaves the frame at its high-x end (label position). */
  public exitPoint(k: number): IsoExitPoint | null {
    const range = this.visibleRange(k);
    if (range === null) {
      return null;
    }
    const x2 = range[1];
    const exitsRight = x2 >= this.xScale.domainMax - Math.abs(this.xScale.domainMax) * 1e-9;
    return {
      x: this.xScale.scale(x2),
      y: this.yScale.scale(k / x2),
      edge: exitsRight ? "right" : "bottom",
    };
  }

  /**
   * Closed SVG path of the region `x·y >= k` inside the frame (the area
   * between the curve and the top-right frame corner), or the full frame
   * when the curve lies entirely below-left of it, or `null` when the
   * region is empty.
   */
  public regionPath(k: number): string | null {
    if (!this.isDrawableDomain() || k <= 0) {
      return null;
    }

    const xMin = this.xScale.domainMin;
    const xMax = this.xScale.domainMax;
    const yMin = this.yScale.domainMin;
    const yMax = this.yScale.domainMax;

    const left = this.xScale.scale(xMin);
    const right = this.xScale.scale(xMax);
    const top = this.yScale.scale(yMax);
    const bottom = this.yScale.scale(yMin);

    if (k >= xMax * yMax) {
      return null;
    }
    if (k <= xMin * yMin) {
      return `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
    }

    const points = this.samples(k)!;
    const [x1, x2] = this.visibleRange(k)!;
    const entersTop = x1 > xMin;
    const exitsRight = x2 >= xMax - Math.abs(xMax) * 1e-9;

    const path: string[] = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`);

    // Walk the frame boundary from the exit point back to the entry point,
    // enclosing the top-right corner.
    if (!exitsRight) {
      path.push(`L ${right} ${bottom}`);
    }
    path.push(`L ${right} ${top}`);
    if (!entersTop) {
      path.push(`L ${left} ${top}`);
    }
    path.push("Z");

    return path.join(" ");
  }
}
