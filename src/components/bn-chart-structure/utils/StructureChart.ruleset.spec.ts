import { StructureChart } from "./StructureChart";
import { StructureChartStyle } from "./model/styles/StructureChartStyle";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { buildStructureChart, structureRow } from "../../../utils/testing/structureChart";

const ROWS = [structureRow("A", 1, { ac1: 10, pp1: 8 }), structureRow("B", 2, { ac1: 12, pp1: 9 })];

interface ChartInternals {
  styles: StructureChartStyle;
  axisScenario: string;
  scenarioStyles(): StructureChartStyle;
}

const chart = (ruleSet?: RuleSetConfig, variances: string[] = []): ChartInternals =>
  buildStructureChart(ROWS, { scenarios: ["ac1", "pp1"], variances }, ruleSet) as unknown as StructureChart &
    ChartInternals;

describe("StructureChart: rule set colorIndex", () => {
  it("draws with the theme styles for the built-in rule set", () => {
    const built = chart();

    expect(built.scenarioStyles()).toBe(built.styles);
  });

  it("draws a scenario in the bar style of the slot its colorIndex selects", () => {
    const built = chart({ scenarios: { pp: { colorIndex: 10 } } });
    const styles = built.scenarioStyles();

    expect(styles.barStyles.getSVGStyle("pp")).toBe(built.styles.barStyles.ac);
    expect(built.styles.barStyles.getSVGStyle("pp")).not.toBe(built.styles.barStyles.ac);
  });

  it("gives the variance axis the look of the slot of the reference scenario", () => {
    expect(chart(undefined, ["dac1_pp1_pos"]).axisScenario).toBe("pp1");
    expect(chart({ scenarios: { pp: { colorIndex: 50 } } }, ["dac1_pp1_pos"]).axisScenario).toBe("pl1");
  });
});
