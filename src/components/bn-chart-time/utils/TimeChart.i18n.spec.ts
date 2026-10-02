import { TimeChart } from "./TimeChart";
import { TimeChartComponentConfigAdapter } from "./model/TimeChartComponentConfig";
import { TimeChartDataRowAdapter } from "./model/TimeChartDataRow";
import { TimeChartStylesAdapter } from "./model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "./model/styles/ScaleFactorsTimeChart";
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

const TABLE = "trend";

const buildChart = (): TimeChart => {
  const scoped = createScopedDb();
  const db = scoped.db;
  db.tables[TABLE] = {
    data: [
      { date: "2026-01-01", category: "Total", categoryIndex: 1, operation: "+", ac1: 100, pp1: 90 },
      { date: "2026-02-01", category: "Total", categoryIndex: 1, operation: "+", ac1: 110, pp1: 95 },
    ],
  };

  const config = new TimeChartComponentConfigAdapter(
    new TimeChartDataRowAdapter(),
    new OrderAdapter(new StringAdapter()),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({
    scenarios: ["ac1", "pp1"],
    variances: ["dac1_pp1_pos"],
    level: "category",
    dateInterval: "month",
  });

  const styles = new TimeChartStylesAdapter(
    new ScaleFactorsTimeChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});

  return new TimeChart(new IBCSRuleSet(), db, TABLE, config, styles);
};

const chartTitle = (chart: TimeChart): string => (chart as unknown as { title: string }).title;

describe("TimeChart variance title i18n", () => {
  it("recomputes the title when setI18n arrives after the constructor", () => {
    const chart = buildChart();
    // Constructor runs setConfig with the built-in default map.
    expect(chartTitle(chart)).toBe("ΔPY");

    // The component calls setI18n after construction - the title must pick
    // up the translated scenario label instead of keeping the default.
    chart.setI18n(new Map([["pp1", "Vorjahr"]]));
    expect(chartTitle(chart)).toBe("ΔVorjahr");
  });
});
