import { createScopedDb } from "../../../context/scopedDb";
import { AggregationLevel } from "../../../utils/constants";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { Order, OrderDirection } from "../../../utils/model/Order";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { SVGVariancesStyleGroupAdapter } from "../../../utils/model/styles/SVGVariancesStyleGroup";
import { SYSTEM_STYLE_DEFAULTS } from "../../../stores/componentStyles";
import { BulletChart, BulletChartConfig } from "./BulletChart";
import { BulletChartStylesAdapter, ScaleFactorsBulletChartAdapter } from "./model/BulletChartStyle";

// Adapt the system defaults so assertions cover the real palette
// (#404040 AC bar, #008f96/#ff0000 variances, #D9D9D9/#EFEFEF bands).
const defaultStyles = () =>
  new BulletChartStylesAdapter(
    new ScaleFactorsBulletChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt(SYSTEM_STYLE_DEFAULTS["bn-chart-bullet"] as unknown as Record<string, unknown>);

const baseConfig = (over: Partial<BulletChartConfig> = {}): BulletChartConfig => ({
  chartTitle: "",
  actual: { measure: "ac1" },
  target: { measure: "pl1" },
  ranges: [],
  normalize: "target",
  showVariances: true,
  level: AggregationLevel.CATEGORY,
  order: new Order(["categoryIndex"], OrderDirection.ASC),
  limit: 0,
  labels: { show: "auto", decimals: 1 },
  ...over,
});

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  operation: "+",
  category: "Revenue",
  categoryIndex: 1,
  ac1: 100,
  pl1: 100,
  ...over,
});

const makeChart = (rows: Record<string, unknown>[], config: BulletChartConfig = baseConfig()): BulletChart => {
  const db = createScopedDb().db;
  db.tables["bulletData"] = { data: rows };
  return new BulletChart(new IBCSRuleSet(), db, "`bulletData`", config, defaultStyles(), 1000);
};

/** Widths of the AC bars (fill #404040) in drawing order. */
const barWidths = (svg: string): number[] =>
  [...svg.matchAll(/<rect[^>]*>/g)]
    .map((match) => match[0])
    .filter((rect) => rect.includes('fill="#404040"'))
    .map((rect) => Number(/width="([^"]+)"/.exec(rect)![1]));

describe("BulletChart", () => {
  it("renders one AC bar per KPI row with category labels and the annotation hook", () => {
    const chart = makeChart([
      row(),
      row({ category: "Profit", categoryIndex: 2, ac1: 80, pl1: 90 }),
      row({ category: "Orders", categoryIndex: 3, ac1: 55, pl1: 50 }),
    ]);

    expect(chart.hasNoData()).toBe(false);
    const svg = chart.toString();
    expect(svg).toContain("<svg");
    expect(barWidths(svg)).toHaveLength(3);
    expect(svg).toContain("Revenue");
    expect(svg).toContain("Profit");
    expect(svg).toContain("Orders");
    expect(svg).toContain('class="annotations"');
    expect(svg).toContain('id="drawCanvas"');
  });

  it("reports no data for an empty table", () => {
    const chart = makeChart([]);
    expect(chart.hasNoData()).toBe(true);
    expect(chart.toString()).toContain("<svg");
  });

  it("normalizes rows to their targets: equal actual/target ratios draw equal bars", () => {
    const chart = makeChart([
      row({ ac1: 100, pl1: 100 }),
      row({ category: "Small", categoryIndex: 2, ac1: 5, pl1: 5 }),
    ]);
    const widths = barWidths(chart.toString());
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeCloseTo(widths[1], 5);
  });

  it("draws a favorable variance in the celeste tone when the actual exceeds the target", () => {
    const svg = makeChart([row({ ac1: 120, pl1: 100 })]).toString();
    expect(svg).toContain("#008f96");
    expect(svg).not.toContain("#ff0000");
  });

  it("draws an unfavorable variance in red when the actual falls short of the target", () => {
    const svg = makeChart([row({ ac1: 80, pl1: 100 })]).toString();
    expect(svg).toContain("#ff0000");
    expect(svg).not.toContain("#008f96");
  });

  it("inverts the sentiment for cost-type KPIs (operation '-')", () => {
    const svg = makeChart([row({ operation: "-", ac1: 80, pl1: 100 })]).toString();
    expect(svg).toContain("#008f96");
    expect(svg).not.toContain("#ff0000");
  });

  it("draws no variance bar when actual equals target", () => {
    const svg = makeChart([row({ ac1: 100, pl1: 100 })]).toString();
    expect(svg).not.toContain("#008f96");
    expect(svg).not.toContain("#ff0000");
  });

  it("suppresses variance bars with showVariances: false", () => {
    const svg = makeChart([row({ ac1: 120, pl1: 100 })], baseConfig({ showVariances: false })).toString();
    expect(svg).not.toContain("#008f96");
    expect(svg).not.toContain("#ff0000");
  });

  it("falls back to actual bars only with bullet-target-none when no row has a target value", () => {
    const chart = makeChart([row({ pl1: null }), row({ category: "Profit", categoryIndex: 2, ac1: 80, pl1: null })]);
    const svg = chart.toString();
    expect(chart.getWarnings().map((w) => w.code)).toContain("bullet-target-none");
    expect(barWidths(svg)).toHaveLength(2);
    expect(svg).not.toContain("#008f96");
    expect(svg).not.toContain("#ff0000");
  });

  it("counts rows without a target value into bullet-target-missing", () => {
    const chart = makeChart([row(), row({ category: "Profit", categoryIndex: 2, pl1: null })]);
    const warning = chart.getWarnings().find((w) => w.code === "bullet-target-missing");
    expect(warning?.data.count).toBe("1");
    // The unnormalizable row draws no bar.
    expect(barWidths(chart.toString())).toHaveLength(1);
  });

  it("counts non-positive targets into bullet-target-invalid and omits their bars", () => {
    const chart = makeChart([row(), row({ category: "Profit", categoryIndex: 2, pl1: -5 })]);
    const warning = chart.getWarnings().find((w) => w.code === "bullet-target-invalid");
    expect(warning?.data.count).toBe("1");
    expect(barWidths(chart.toString())).toHaveLength(1);
  });

  it("warns on mixed '+'/'-' operations within one KPI group", () => {
    const chart = makeChart([row(), row({ operation: "-" })]);
    const warning = chart.getWarnings().find((w) => w.code === "bullet-mixed-operation");
    expect(warning?.data.count).toBe("1");
  });

  it("classic mode draws per-row scales: equal ratios at different magnitudes still draw equal bars", () => {
    const chart = makeChart(
      [row({ ac1: 100, pl1: 100 }), row({ category: "Small", categoryIndex: 2, ac1: 10, pl1: 10 })],
      baseConfig({ normalize: "none" }),
    );
    const widths = barWidths(chart.toString());
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeCloseTo(widths[1], 5);
  });

  it("classic mode draws the qualitative range bands and tick labels", () => {
    const svg = makeChart(
      [row({ ac1: 80, pl1: 100 })],
      baseConfig({ normalize: "none", ranges: [0.6, 0.9] }),
    ).toString();
    // svg.js lowercases hex colors on output.
    expect(svg).toContain("#d9d9d9");
    expect(svg).toContain("#efefef");
    // Per-row axis strip: nice ticks of the [0, 100] domain.
    expect(svg).toContain(">50<");
  });

  it("does not draw range bands in normalized mode", () => {
    const svg = makeChart([row({ ac1: 80, pl1: 100 })], baseConfig({ ranges: [0.6, 0.9] })).toString();
    expect(svg.toLowerCase()).not.toContain("#d9d9d9");
    expect(svg.toLowerCase()).not.toContain("#efefef");
  });

  it("truncates to the first `limit` rows without a REST aggregate", () => {
    const chart = makeChart(
      [row(), row({ category: "Profit", categoryIndex: 2 }), row({ category: "Orders", categoryIndex: 3 })],
      baseConfig({ limit: 2 }),
    );
    const svg = chart.toString();
    expect(barWidths(svg)).toHaveLength(2);
    expect(svg).not.toContain("REST");
    expect(svg).not.toContain("Orders");
  });

  it("orders rows by the configured measure and direction", () => {
    const svg = makeChart(
      [
        row({ category: "Alpha", categoryIndex: 1, ac1: 10, pl1: 10 }),
        row({ category: "Bravo", categoryIndex: 2, ac1: 99, pl1: 99 }),
      ],
      baseConfig({ order: new Order(["ac1"], OrderDirection.DESC) }),
    ).toString();
    expect(svg.indexOf("Bravo")).toBeLessThan(svg.indexOf("Alpha"));
  });

  it("applies desc to the first of two order columns", () => {
    const svg = makeChart(
      [
        row({ category: "Alpha", categoryIndex: 1, ac1: 100, pl1: 100 }),
        row({ category: "Bravo", categoryIndex: 2, ac1: -50, pl1: 100 }),
        row({ category: "Charlie", categoryIndex: 3, ac1: 110, pl1: 100 }),
      ],
      baseConfig({ order: new Order(["ac1", "category"], OrderDirection.DESC) }),
    ).toString();
    const drawn = ["Alpha", "Bravo", "Charlie"].sort((a, b) => svg.indexOf(a) - svg.indexOf(b));

    // ac1: Charlie 110, Alpha 100, Bravo -50
    expect(drawn).toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  it("grows the canvas height linearly with the row count", () => {
    const one = makeChart([row()]);
    const three = makeChart([
      row(),
      row({ category: "Profit", categoryIndex: 2 }),
      row({ category: "Orders", categoryIndex: 3 }),
    ]);
    const rowBlock = one.styles.scaleFactors.rowHeight * one.styles.fontStyles.size;
    expect(three.getAllocatedCanvasHeight() - one.getAllocatedCanvasHeight()).toBeCloseTo(2 * rowBlock, 5);
  });

  it("labels the shared target line via the i18n map", () => {
    const chart = makeChart([row({ ac1: 120, pl1: 100 })]);
    chart.setI18n(new Map([["target", "Ziel"]]));
    expect(chart.toString()).toContain("Ziel");
  });
});
