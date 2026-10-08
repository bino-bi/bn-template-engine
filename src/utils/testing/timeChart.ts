import { TimeChart } from "../../components/bn-chart-time/utils/TimeChart";
import { TimeChartComponentConfigAdapter } from "../../components/bn-chart-time/utils/model/TimeChartComponentConfig";
import { TimeChartDataRowAdapter } from "../../components/bn-chart-time/utils/model/TimeChartDataRow";
import { TimeChartStylesAdapter } from "../../components/bn-chart-time/utils/model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "../../components/bn-chart-time/utils/model/styles/ScaleFactorsTimeChart";
import { createScopedDb, buildFromExpr } from "../../context/scopedDb";
import { IBCSRuleSet } from "../ibcsRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import { StringAdapter } from "../helper/StringAdapter";
import { DataFormatDigitsAdapter } from "../model/DataFormatDigits";
import { FontStyleAdapter } from "../model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../model/styles/Padding";

const TABLE = "trend";

/** One data row of a time chart spec; `date` is an ISO string or epoch millis. */
export function timeRow(date: string | number, values: Record<string, unknown>): Record<string, unknown> {
  return { date, category: "Total", categoryIndex: 1, operation: "+", ...values };
}

/** Builds a TimeChart over `rows` in a scoped database of its own, for specs. */
export function buildTimeChart(
  rows: Record<string, unknown>[],
  config: Record<string, unknown>,
  ruleSet?: RuleSetConfig,
): TimeChart {
  const db = createScopedDb().db;
  db.tables[TABLE] = { data: rows };

  const chartConfig = new TimeChartComponentConfigAdapter(
    new TimeChartDataRowAdapter(),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt(config);

  const styles = new TimeChartStylesAdapter(
    new ScaleFactorsTimeChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});

  return new TimeChart(new IBCSRuleSet(ruleSet), db, TABLE, chartConfig, styles);
}
