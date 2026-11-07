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

  it("marks the zero line as the chart's baseline", () => {
    const svg = makeChart([row()]).toString();
    expect((svg.match(/<line[^>]*data-bn-baseline="axis"/g) || []).length).toBe(1);
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

  describe("operation sign and negative actuals", () => {
    const values = (chart: BulletChart): [number | null, number | null][] =>
      (chart as unknown as { rows: { actual: number | null; target: number | null }[] }).rows.map((entry) => [
        entry.actual,
        entry.target,
      ]);
    const codes = (chart: BulletChart): string[] => chart.getWarnings().map((warning) => warning.code);
    const count = (chart: BulletChart, code: string): string | undefined =>
      chart.getWarnings().find((warning) => warning.code === code)?.data.count;

    it("subtracts the '-' rows of a KPI group that mixes '+' and '-' rows", () => {
      // revenue 100 and cost 30 in one group: 70, not 130
      const chart = makeChart([row({ ac1: 100, pl1: 90 }), row({ operation: "-", ac1: 30, pl1: 25 })]);

      expect(values(chart)).toEqual([[70, 65]]);
      expect(count(chart, "bullet-mixed-operation")).toBe("1");
    });

    it("keeps the positive value of a group with only '-' rows", () => {
      const chart = makeChart([row({ operation: "-", ac1: 30, pl1: 25 }), row({ operation: "-", ac1: 50, pl1: 40 })]);

      expect(values(chart)).toEqual([[80, 65]]);
      expect(codes(chart)).not.toContain("bullet-mixed-operation");
    });

    it.each(["target", "none"] as const)("names a negative actual in its own warning (normalize %s)", (normalize) => {
      const chart = makeChart(
        [row(), row({ category: "Profit", categoryIndex: 2, ac1: -20, pl1: 100 })],
        baseConfig({ normalize }),
      );

      expect(count(chart, "bullet-actual-negative")).toBe("1");
      // the target of 100 is fine: this is not a target problem
      expect(codes(chart)).not.toContain("bullet-target-invalid");
      // only the first row has a bar
      expect(barWidths(chart.toString())).toHaveLength(1);
    });

    it("sorts and limits by the net value that a mixed group shows", () => {
      const rows = [
        row({ category: "Result", categoryIndex: 1, ac1: 100, pl1: 100 }),
        row({ category: "Result", categoryIndex: 1, operation: "-", ac1: 30, pl1: 30 }),
        row({ category: "Orders", categoryIndex: 2, ac1: 100, pl1: 100 }),
        row({ category: "Sales", categoryIndex: 3, ac1: 120, pl1: 120 }),
      ];
      const sorted = (limit: number): [string, number | null][] =>
        (
          makeChart(rows, baseConfig({ order: new Order(["ac1"], OrderDirection.DESC), limit })) as unknown as {
            rows: { category: string; actual: number | null }[];
          }
        ).rows.map((entry) => [entry.category, entry.actual]);

      // Result was sorted with the plain sum 130 and shown as 70
      expect(sorted(0)).toEqual([
        ["Sales", 120],
        ["Orders", 100],
        ["Result", 70],
      ]);
      expect(sorted(2)).toEqual([
        ["Sales", 120],
        ["Orders", 100],
      ]);
    });

    it("takes a net value that is 0 up to float rounding as 0", () => {
      // 0.3 - 0.1 - 0.2 is -2.8e-17
      const chart = makeChart([
        row({ ac1: 0.3, pl1: 1 }),
        row({ operation: "-", ac1: 0.1, pl1: 0 }),
        row({ operation: "-", ac1: 0.2, pl1: 0 }),
      ]);

      expect(values(chart)).toEqual([[0, 1]]);
      expect(codes(chart)).not.toContain("bullet-actual-negative");
    });

    it("counts a mixed group with a negative net value as negative actual", () => {
      const chart = makeChart([row({ ac1: 10, pl1: 100 }), row({ operation: "-", ac1: 30, pl1: 20 })]);

      expect(values(chart)).toEqual([[-20, 80]]);
      expect(count(chart, "bullet-actual-negative")).toBe("1");
    });
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
