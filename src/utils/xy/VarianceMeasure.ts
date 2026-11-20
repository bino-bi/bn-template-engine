import { Scenarios } from "../constants";
import { relativeVariance } from "../relativeVariance";
import { AxisConfig } from "./model/AxisConfig";

/**
 * Variance-token parser for XY chart axis measures.
 *
 * Reuses the engine's variance grammar (`d{base}_{delta}_{sentiment}` /
 * `dr{base}_{delta}_{sentiment}`) with one deviation from
 * {@link VarianceScenario}: on axes the trailing sentiment segment is
 * **optional and ignored** - position encodes the value, there is no
 * pos/neg coloring. The regex is anchored, so partial matches inside a
 * longer token are rejected.
 */
const VARIANCE_MEASURE_REGEX = /^(dr|d)((?:ac|pp|fc|pl)[1-4])_((?:ac|pp|fc|pl)[1-4])(?:_(pos|neg|neu|op|opinv))?$/;

export class VarianceMeasure {
  private constructor(
    /** `"d"` = absolute, `"dr"` = relative (fraction of delta). */
    public readonly type: "d" | "dr",
    /** Minuend scenario slot, e.g. `"ac1"`. */
    public readonly base: string,
    /** Subtrahend scenario slot, e.g. `"pp1"`. */
    public readonly delta: string,
  ) {}

  /** Parses a variance token; returns `null` when the token doesn't match the grammar. */
  public static parse(token: string): VarianceMeasure | null {
    const match = VARIANCE_MEASURE_REGEX.exec(token);
    if (match === null) {
      return null;
    }
    return new VarianceMeasure(match[1] as "d" | "dr", match[2], match[3]);
  }

  /**
   * Computes the variance value, mirroring the null-safe math of the
   * existing charts: absolute = `base - delta`, relative =
   * `(base - delta) / |delta|`. Returns `null` when either operand is
   * missing or a relative variance would divide by zero.
   */
  public compute(base: number | null | undefined, delta: number | null | undefined): number | null {
    if (base == null || delta == null) {
      return null;
    }

    if (this.type === "dr") {
      if (delta === 0) {
        return null;
      }
      return relativeVariance(base - delta, delta) ?? null;
    }

    return base - delta;
  }
}

/** A resolved axis measure: either a plain scenario slot or a variance. */
export type MeasureRef = { kind: "scenario"; slot: string } | { kind: "variance"; measure: VarianceMeasure };

/**
 * Resolves a measure token to a scenario slot or a variance measure.
 * Returns `null` for tokens matching neither vocabulary.
 */
export function resolveMeasure(token: string): MeasureRef | null {
  const trimmed = token.trim();

  if ((Object.values(Scenarios) as string[]).includes(trimmed)) {
    return { kind: "scenario", slot: trimmed };
  }

  const variance = VarianceMeasure.parse(trimmed);
  if (variance !== null) {
    return { kind: "variance", measure: variance };
  }

  return null;
}

/**
 * Scenario family (`ac` | `pp` | `fc` | `pl`) of a plain scenario slot.
 */
export function scenarioFamily(slot: string): string {
  return slot.replace(/\d+$/, "");
}

/** Slot number (`1`-`4`) of a plain scenario slot. */
export function scenarioSlotNumber(slot: string): string {
  return slot.replace(/^[a-z]+/, "");
}

/** True for a relative variance token (`dr…`): its values are fractions and are shown in percent. */
export function isRelativeMeasure(token: string): boolean {
  return VarianceMeasure.parse(token.trim())?.type === "dr";
}

/**
 * The axis config in the unit of the axis values. A relative variance axis is written
 * in percent (`min: -40`, `refLine: 20`), while its values are fractions (0.2 for 20 %).
 */
export function axisInValueUnits(axis: AxisConfig): AxisConfig {
  if (!isRelativeMeasure(axis.measure)) {
    return axis;
  }

  const fraction = (percent: number | undefined): number | undefined =>
    percent === undefined ? undefined : percent / 100;

  return {
    ...axis,
    min: fraction(axis.min),
    max: fraction(axis.max),
    refLine: fraction(axis.refLine),
    step: fraction(axis.step),
    highlight: axis.highlight && { from: fraction(axis.highlight.from), to: fraction(axis.highlight.to) },
  };
}
