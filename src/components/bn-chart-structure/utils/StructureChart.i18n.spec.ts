import { StructureChart } from "./StructureChart";
import { StructureChartComponentConfigAdapter, StructureChartDataRowAdapter } from "./model";
import { StructureChartStylesAdapter } from "./model/styles/StructureChartStyle";
import { ScaleFactorsStructureChartAdapter } from "./model";
import { createScopedDb, buildFromExpr } from "../../../context/scopedDb";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { OrderAdapter } from "../../../utils/model/Order";
import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";

const TABLE = "cities";

const buildChart = (): StructureChart => {
  const scoped = createScopedDb();
  const db = scoped.db;
  db.tables[TABLE] = {
    data: [
      { operation: "+", category: "Berlin", categoryIndex: 1, ac1: 100, pp1: 90 },
      { operation: "+", category: "Munich", categoryIndex: 2, ac1: 80, pp1: 95 },
    ],
  };

  const config = new StructureChartComponentConfigAdapter(
    new StructureChartDataRowAdapter(),
    new OrderAdapter(new StringAdapter()),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1", "pp1"],
    variances: ["dac1_pp1_pos"],
    level: "category",
  });

  const styles = new StructureChartStylesAdapter(
    new ScaleFactorsStructureChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});

  return new StructureChart(new IBCSRuleSet(), db, TABLE, config, styles);
};

const chartTitle = (chart: StructureChart): string => (chart as unknown as { title: string }).title;

describe("StructureChart variance title i18n", () => {
  it("recomputes the title when setI18n arrives after the constructor", () => {
    const chart = buildChart();
    // Constructor runs setConfig with the built-in default map.
    expect(chartTitle(chart)).toBe("ΔPY");

    // The component calls setI18n after construction - the title must pick
    // up the translated scenario label instead of keeping the default.
    chart.setI18n(new Map([["pp1", "Vorjahr"]]));
    expect(chartTitle(chart)).toBe("ΔVorjahr");
  });

  it("keeps an explicit config title untouched by setI18n", () => {
    const chart = buildChart();
    const config = new StructureChartComponentConfigAdapter(
      new StructureChartDataRowAdapter(),
      new OrderAdapter(new StringAdapter()),
      new StringAdapter(),
      new DataFormatDigitsAdapter(),
      (chart as unknown as { db: unknown }).db as never,
      buildFromExpr(TABLE, ""),
    ).adapt({
      scenarios: ["ac1", "pp1"],
      variances: ["dac1_pp1_pos"],
      level: "category",
      title: "My Title",
    });
    chart.setConfig(config);
    chart.setI18n(new Map([["pp1", "Vorjahr"]]));
    expect(chartTitle(chart)).toBe("My Title");
  });
});
