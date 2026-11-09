/**
 * Parses an IBCS variance column name into its constituent parts.
 *
 * Naming convention: `d{base}_{delta}_{sentiment}` for absolute variance,
 * `dr{base}_{delta}_{sentiment}` for relative (%) variance.
 *
 * Example: `"dac1_pl1_pos"` → type="d", base="ac1" (minuend), delta="pl1" (subtrahend), direction="pos"
 */
export class VarianceScenario {
  /** `"d"` for absolute variance, `"dr"` for relative (percentage) variance */
  readonly type: string = "";
  /** Minuend scenario (the value subtracted from), e.g. `"ac1"` */
  readonly base: string = "";
  /** Subtrahend scenario (the value subtracted), e.g. `"pl1"` */
  readonly delta: string = "";
  /**
   * Sentiment direction: `"pos"` (favorable), `"neg"` (unfavorable), `"neu"` (neutral),
   * `"op"` (follows the row operation) or `"opinv"` (inverse of `"op"`). See {@link resolveSentiment}.
   */
  readonly direction: string = "";
  readonly isValid: boolean = false;

  constructor(scenario: string) {
    /** Capture groups: [1]=type (d|dr), [2]=base scenario, [3]=delta scenario, [4]=sentiment */
    // not anchored on purpose, some callers pass a joined list; opinv must come before op
    const scenarioTestRegex = /(d|dr)(pl\d|ac\d|fc\d|pp\d)_(pl\d|ac\d|fc\d|pp\d)_(pos|neg|neu|opinv|op)/;
    if (scenarioTestRegex.test(scenario)) {
      const tokens = scenarioTestRegex.exec(scenario);
      if (tokens != null) {
        this.type = String(tokens[1]);
        this.base = String(tokens[2]);
        this.delta = String(tokens[3]);
        this.direction = String(tokens[4]);
        this.isValid = true;
      }
    }
  }
}

/**
 * Resolves a variance sentiment to `"pos"`, `"neg"` or `"neu"` for one row.
 *
 * `"op"` colours by the contribution to the result: on a `"-"` row it acts like `"neg"`,
 * on every other row (`"+"`, `"="`) like `"pos"`. `"opinv"` is the inverse.
 * When the values are already signed by their operation (`signedValues`, e.g. sum/list
 * tables and charts), `"op"` always acts like `"pos"` and `"opinv"` like `"neg"`.
 */
export function resolveSentiment(
  direction: string,
  operation: string | null | undefined,
  signedValues: boolean,
): string {
  if (direction !== "op" && direction !== "opinv") {
    return direction;
  }
  const subtracts = !signedValues && operation === "-";
  return (direction === "op") !== subtracts ? "pos" : "neg";
}
