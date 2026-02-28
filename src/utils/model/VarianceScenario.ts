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
  /** Sentiment direction: `"pos"` (favorable), `"neg"` (unfavorable), `"neu"` (neutral) */
  readonly direction: string = "";
  readonly isValid: boolean = false;

  constructor(scenario: string) {
    /** Capture groups: [1]=type (d|dr), [2]=base scenario, [3]=delta scenario, [4]=sentiment */
    const scenarioTestRegex = /(d|dr)(pl\d|ac\d|fc\d|pp\d)_(pl\d|ac\d|fc\d|pp\d)_(pos|neg|neu)/;
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
