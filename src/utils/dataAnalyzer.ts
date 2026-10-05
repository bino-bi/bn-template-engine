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
  private static unitsLeast = ["m", "my", "n", "p", "f", "a", "z", "y"];

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
    onError?: (e: unknown) => void,
  ): SiPrefix {
    if (mode === "_") {
      return new SiPrefix();
    }

    // Accept the Unicode micro sign as an alias for the ASCII "my" key.
    if (mode === "μ") {
      mode = "my";
    }

    if (mode != null) {
      if ([...this.unitsLeast, ...this.unitsGreat].includes(mode)) {
        return this.lookupPrefix(mode);
      }
    }

    // filtering wordlenght == 3, so variances are not considered
    const baseScenarios = scenarios.filter((word) => word.length === 3);

    // GREATEST() without arguments is no valid query
    if (baseScenarios.length === 0 || !fromExpr) {
      return new SiPrefix();
    }

    const queryMax = `SELECT MAX(GREATEST(${baseScenarios.map((x) => "ABS(" + x + ")").toString()})) as prefixvalue
                      FROM ${fromExpr}`;
    const queryMin = `SELECT MIN(LEAST(${baseScenarios.map((x) => "ABS(" + x + ")").toString()})) as prefixvalue
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
      // the caller reports it as ERR_sql
      onError?.(e);
      return new SiPrefix();
    }

    return this.determinePrefix(Math.abs(num));
  }

  /**
   * Maps an absolute numeric value to the best-fitting SI prefix based on
   * its decimal magnitude. Values in (0.001, 1000) keep the identity prefix.
   * Magnitudes beyond the covered SI range clamp to the outermost prefix.
   */
  private static determinePrefix(num: number): SiPrefix {
    if (!Number.isFinite(num) || num <= 0) {
      return new SiPrefix();
    }

    if (num >= 1000) {
      const idx = Math.min(Math.floor(Math.log10(num) / 3), this.unitsGreat.length) - 1;
      return new SiPrefix(this.unitsGreat[idx], Math.pow(1000, idx + 1));
    }

    if (num <= 0.001) {
      const idx = Math.min(-Math.floor(Math.log10(num) / 3), this.unitsLeast.length) - 1;
      return new SiPrefix(this.unitsLeast[idx], Math.pow(1000, -(idx + 1)));
    }

    return new SiPrefix();
  }

  /** Looks up an explicit SI prefix string in the NumeralFigure enum. */
  private static lookupPrefix(mode: string): SiPrefix {
    return new SiPrefix(mode, NumeralFigure[mode as keyof typeof NumeralFigure]);
  }
}
