import { Scenario } from "./index";
import { DataPointKey } from "../../../../utils/layoutState/types";

/**
 * A single renderable data point in a structural (categorical) bar chart.
 *
 * Encapsulates a numeric value, its IBCS scenario type, and the vertical scale factor.
 * Provides scaling and variance styling logic used by the chart renderer.
 *
 * Variance direction follows IBCS convention: the declared variance ("pos"/"neg") applies
 * to non-negative values; for negative values, the style is flipped (pos becomes neg and
 * vice versa) so that visual encoding always reflects the economic meaning.
 */
export class DataPoint {
  /** undefined on a relative variance: the reference is 0, shown as "n/a". */
  public value: number | null | undefined;
  /** Scenario identifier (e.g. Scenario.AC1) or raw string. */
  public scenario: Scenario | string | null;
  /** Vertical scale: pixels per one data unit. */
  public pixelPerUnit: number;
  /** Variance direction for IBCS color coding (POS=green, NEG=red, NEU=grey). */
  public variance: Scenario | string;
  /** The data row this point shows. Written as `data-bn-*` attributes on what is drawn for it. */
  public key?: DataPointKey;

  constructor(
    value: number | null | undefined,
    scenario: Scenario | string | null,
    pixelPerUnit: number | null,
    variance: Scenario | string | null,
  ) {
    this.value = value;
    this.scenario = scenario;
    this.pixelPerUnit = pixelPerUnit || 1;

    if (variance === "neg" || variance === Scenario.NEG) {
      this.variance = Scenario.NEG;
    } else if (variance === "pos" || variance === Scenario.POS) {
      this.variance = Scenario.POS;
    } else {
      this.variance = Scenario.NEU;
    }
  }

  public isEmpty(): boolean {
    return null == this.value || null == this.scenario;
  }

  /** Returns the value scaled to pixel length for absolute (non-percentage) bars. */
  public getScaledUnit(): number {
    if (this.value == null) {
      return 0;
    }

    return this.value * this.pixelPerUnit;
  }

  /**
   * Returns the percentage value scaled to pixel length, clipped at +/-145%.
   *
   * Values beyond +/-1.45 (145%) are clamped to prevent extreme bars from
   * distorting the chart layout. Use {@link isClipped} to check if clipping occurred.
   */
  public getScaledPercentUnit(): number {
    if (this.value == null) {
      return 0;
    }

    if (Math.abs(this.value) > 1.45) {
      if (this.value >= 0) {
        return 1.45 * this.pixelPerUnit;
      } else {
        return -1.45 * this.pixelPerUnit;
      }
    } else {
      return this.value * this.pixelPerUnit;
    }
  }

  /**
   * Returns the IBCS variance color style, flipping pos/neg for negative values.
   *
   * IBCS rule: a "positive variance" on a negative value is economically unfavorable,
   * so the visual style must invert. NEU (neutral) is never flipped.
   */
  public getVarianceStyle(): Scenario {
    if (this.value == null) {
      return this.variance as Scenario;
    }

    if (this.value >= 0) {
      return this.variance as Scenario;
    } else {
      //flip the style
      if (Scenario.NEU === this.variance) {
        return Scenario.NEU;
      }
      if (Scenario.POS === this.variance) {
        return Scenario.NEG;
      } else {
        return Scenario.POS;
      }
    }
  }

  /** Returns true if the percentage value exceeds the +/-145% clipping threshold. */
  isClipped(): boolean {
    if (this.value == null) {
      return false;
    }

    return Math.abs(this.value) > 1.45;
  }

  /** Returns the fixed display value (145) shown on clipped percentage bars. */
  getClippedValue(): number {
    return 145;
  }

  /** Extracts the 2-character scenario type prefix (e.g. "ac" from "ac1", "pl" from "pl2"). */
  getScenario() {
    return this.scenario?.slice(0, 2);
  }
}
