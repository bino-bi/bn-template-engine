export class VarianceScenario {
  readonly type: string = "";
  readonly base: string = "";
  readonly delta: string = "";
  readonly direction: string = "";
  readonly isValid: boolean = false;

  constructor(scenario: string) {
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
