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

const TABLE = "products";

/** Categories of the chart rows, top to bottom. */
const categories = (hierarchy: string[], direction: string): string[] => {
  const db = createScopedDb().db;
  db.tables[TABLE] = {
    data: [
      { operation: "+", category: "A", categoryIndex: 1, ac1: 100 },
      { operation: "+", category: "B", categoryIndex: 2, ac1: -50 },
      { operation: "+", category: "C", categoryIndex: 3, ac1: 110 },
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
    scenarios: ["ac1"],
    level: "category",
    sortOrder: { hierarchy, direction },
  });

  const styles = new StructureChartStylesAdapter(
    new ScaleFactorsStructureChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});

  const chart = new StructureChart(new IBCSRuleSet(), db, TABLE, config, styles);
  return (chart as unknown as { dataModel: { category: string }[] }).dataModel.map((entry) => entry.category);
};

describe("structure chart order", () => {
  it("applies desc to the first of two order columns", () => {
    // ac1: C 110, A 100, B -50
    expect(categories(["ac1", "category"], "desc")).toEqual(["C", "A", "B"]);
  });

  it("orders by one column in the given direction", () => {
    expect(categories(["ac1"], "desc")).toEqual(["C", "A", "B"]);
    expect(categories(["ac1"], "asc")).toEqual(["B", "A", "C"]);
  });
});
