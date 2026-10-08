import { TimeChart } from "./TimeChart";
import { TimeChartStyle } from "./model/styles/TimeChartStyle";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { buildTimeChart, timeRow } from "../../../utils/testing/timeChart";

const ROWS = [timeRow("2024-01-01", { ac1: 10, pp1: 8, pl1: 9 }), timeRow("2024-02-01", { ac1: 12, pp1: 9, pl1: 11 })];

interface ChartInternals {
  styles: TimeChartStyle;
  axisScenario: string;
  scenarioStyles(): TimeChartStyle;
}

const chart = (ruleSet?: RuleSetConfig, variances: string[] = []): ChartInternals =>
  buildTimeChart(
    ROWS,
    { scenarios: ["ac1", "pp1"], variances, dateInterval: "month" },
    ruleSet,
  ) as unknown as TimeChart & ChartInternals;

describe("TimeChart: rule set colorIndex", () => {
  it("draws with the theme styles for the built-in rule set", () => {
    const built = chart();

    expect(built.scenarioStyles()).toBe(built.styles);
  });

  it("draws with the theme styles for a rule set that restates the built-in values", () => {
    const built = chart({ scenarios: { pp: { colorIndex: 20 }, ac: { colorIndex: 10 } } });

    expect(built.scenarioStyles()).toBe(built.styles);
  });

  it("draws a scenario in the bar style of the slot its colorIndex selects", () => {
    const built = chart({ scenarios: { pp: { colorIndex: 30 } } });
    const styles = built.scenarioStyles();

    expect(styles.barStyles.pp).toBe(built.styles.barStyles.fc);
    expect(styles.barStyles.ac).toBe(built.styles.barStyles.ac);
    // the theme keeps its slots: the hatch pattern is built from them
    expect(built.styles.barStyles.pp).not.toBe(built.styles.barStyles.fc);
    expect(styles.pattern).toBe(built.styles.pattern);
  });

  it("gives the variance axis the look of the slot of the reference scenario", () => {
    expect(chart(undefined, ["dac1_pp1_pos"]).axisScenario).toBe("pp1");
    expect(chart({ scenarios: { pp: { colorIndex: 50 } } }, ["dac1_pp1_pos"]).axisScenario).toBe("pl1");
  });
});
