/**
 * Area-true bubble sizing: bubble **area** is proportional to the data
 * value (IBCS), so radius grows with the square root.
 *
 * Two modes:
 * - **Local** (default): radii are normalized to the chart's own maximum
 *   value - `r = rMax · √(v / vMax)` with a minimum visible radius.
 *   `vMax` must be the max across all panels and both scenario sets of the
 *   chart instance (shared size scale, mandatory for comparability).
 * - **Grouped** (`bn-scaling-group`): the group value is interpreted as
 *   **area px² per data unit** - `r = √(area · v / π)` with no
 *   normalization and no radius caps, so identical values render at
 *   identical sizes across every chart referencing the group.
 */
export class RadiusScale {
  private constructor(
    private readonly mode: "local" | "grouped",
    private readonly vMax: number,
    private readonly rMaxPx: number,
    private readonly rMinPx: number,
    private readonly areaPerUnitPx2: number,
  ) {}

  public static local(vMax: number, rMaxPx: number, rMinPx: number): RadiusScale {
    return new RadiusScale("local", vMax, rMaxPx, rMinPx, 0);
  }

  public static grouped(areaPerUnitPx2: number): RadiusScale {
    return new RadiusScale("grouped", 0, 0, 0, areaPerUnitPx2);
  }

  /** Radius in pixels for a size value (values must be >= 0). */
  public radius(value: number): number {
    if (this.mode === "grouped") {
      if (value <= 0) {
        return 0;
      }
      return Math.sqrt((this.areaPerUnitPx2 * value) / Math.PI);
    }

    if (this.vMax <= 0 || value <= 0) {
      return this.rMinPx;
    }
    return Math.max(this.rMinPx, this.rMaxPx * Math.sqrt(value / this.vMax));
  }
}
