import { AlaSQLDatabase } from "../context/scopedDb";
import { SiPrefix } from "./model/SiPrefix";

/**
 * SI prefix lookup table mapping prefix symbols to their numeric multipliers.
 * Used by {@link DataAnalyzer.calculateMeasureScale} to convert a prefix string
 * (e.g. `"M"` for mega) into the corresponding divisor for display scaling.
 *
 * Covers the full SI range from yocto (10^-24) to yotta (10^24).
 * Note: `"my"` is used instead of `"μ"` (micro) for ASCII compatibility.
 */
export enum NumeralFigure {
  "Y" = 1e24,
  "Z" = 1e21,
  "E" = 1e18,
  "P" = 1e15,
  "T" = 1e12,
  "G" = 1000000000,
  "M" = 1000000,
  "k" = 1000,
  "h" = 100,
  "da" = 10,
  "d" = 0.1,
  "c" = 0.01,
  "m" = 0.001,
  "my" = 0.000001,
  "n" = 0.000000001,
  "p" = 0.000000000001,
  "f" = 0.000000000000001,
  "a" = 0.000000000000000001,
  "z" = 0.000000000000000000001,
  "y" = 0.000000000000000000000001,
}

/**
 * Analyzes dataset values to determine the appropriate SI prefix for display scaling.
 */
export class DataAnalyzer {
  /** SI prefixes for large numbers, ordered by magnitude (k=10^3 .. Y=10^24). */
  private static unitsGreat = ["k", "M", "G", "T", "P", "E", "Z", "Y"];
  /** SI prefixes for small numbers, ordered by magnitude (m=10^-3 .. y=10^-24). */
  private static unitsLeast = ["m", "my", "n", "p", "P", "f", "a", "z", "y"];

  /**
   * Determines the appropriate SI prefix for scaling displayed values.
   *
   * Modes:
   * - `"_"` (underscore): no scaling, returns identity prefix
   * - Explicit prefix (e.g. `"k"`, `"M"`): direct lookup in NumeralFigure enum
   * - `"GREATEST"` (default) / `"LEAST"`: auto-detect from the MAX or MIN of
   *   absolute base scenario values. Only 3-character scenario names (e.g. `ac1`)
   *   are considered; variance columns are excluded.
   * - `null` with data: defaults to GREATEST auto-detection
   */
  static calculateMeasureScale(
    db: AlaSQLDatabase,
    fromExpr: string,
    scenarios: string[],
    mode: string | null,
  ): SiPrefix {
    if (mode === "_") {
      return new SiPrefix();
    }

    if (mode != null) {
      if ([...this.unitsLeast, ...this.unitsGreat].includes(mode)) {
        return this.lookupPrefix(mode);
      }
    }

    if (scenarios.length === 0 || !fromExpr) {
      return new SiPrefix();
    }

    // filtering wordlenght == 3, so variances are not considered
    const queryMax = `SELECT MAX(GREATEST(${scenarios
      .filter((word) => word.length === 3)
      .map((x) => "ABS(" + x + ")")
      .toString()})) as prefixvalue
                      FROM ${fromExpr}`;
    const queryMin = `SELECT MIN(LEAST(${scenarios
      .filter((word) => word.length === 3)
      .map((x) => "ABS(" + x + ")")
      .toString()})) as prefixvalue
                      FROM ${fromExpr}`;

    let query = queryMax;

    if (mode?.toUpperCase() === "LEAST") {
      query = queryMin;
    }

    let num: number;
    try {
      const result = db.exec<{ prefixvalue?: number }[]>(query);
      num = result[0]?.prefixvalue ?? 0;
    } catch (e) {
      console.error("DataAnalyzer: measure-scale query failed", query, e);
      return new SiPrefix();
    }

    return this.determinePrefix(Math.abs(num));
  }

  /** Maps an absolute numeric value to the best-fitting SI prefix based on digit count. */
  private static determinePrefix(num: number): SiPrefix {
    if (num >= 1000) {
      const floor = Math.floor(Math.floor(Math.abs(num)).toString().length / 3);
      const value = +Math.pow(1000, floor);

      return new SiPrefix(this.unitsGreat[floor - 1], value);
    }

    if (num <= 0.001) {
      const floor = Math.floor(Math.abs(num).toString().length / 3);
      const value = +(1 / Math.pow(1000, floor));

      return new SiPrefix(this.unitsLeast[floor - 1], value);
    }

    return new SiPrefix();
  }

  /** Looks up an explicit SI prefix string in the NumeralFigure enum. */
  private static lookupPrefix(mode: string): SiPrefix {
    return new SiPrefix(mode, NumeralFigure[mode as keyof typeof NumeralFigure]);
  }
}
