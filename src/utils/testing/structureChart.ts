import { StructureChart } from "../../components/bn-chart-structure/utils/StructureChart";
import {
  ScaleFactorsStructureChartAdapter,
  StructureChartComponentConfigAdapter,
  StructureChartDataRowAdapter,
} from "../../components/bn-chart-structure/utils/model";
import { StructureChartStylesAdapter } from "../../components/bn-chart-structure/utils/model/styles/StructureChartStyle";
import { createScopedDb, buildFromExpr } from "../../context/scopedDb";
import { IBCSRuleSet } from "../ibcsRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import { OrderAdapter } from "../model/Order";
import { StringAdapter } from "../helper/StringAdapter";
import { DataFormatDigitsAdapter } from "../model/DataFormatDigits";
import { FontStyleAdapter } from "../model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../model/styles/Padding";

const TABLE = "products";

/** One data row of a structure chart spec. */
export function structureRow(
  category: string,
  index: number,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return { operation: "+", category, categoryIndex: index, ...values };
}

/** Builds a StructureChart over `rows` in a scoped database of its own, for specs. */
export function buildStructureChart(
  rows: Record<string, unknown>[],
  config: Record<string, unknown>,
  ruleSet?: RuleSetConfig,
): StructureChart {
  const db = createScopedDb().db;
  db.tables[TABLE] = { data: rows };

  const chartConfig = new StructureChartComponentConfigAdapter(
    new StructureChartDataRowAdapter(),
    new OrderAdapter(new StringAdapter()),
    new StringAdapter(),
    new DataFormatDigitsAdapter(),
    db,
    buildFromExpr(TABLE, ""),
  ).adapt({ level: "category", ...config });

  const styles = new StructureChartStylesAdapter(
    new ScaleFactorsStructureChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});

  return new StructureChart(new IBCSRuleSet(ruleSet), db, TABLE, chartConfig, styles);
}
