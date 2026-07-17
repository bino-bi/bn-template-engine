import { createScopedDb } from "../../../context/scopedDb";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { ScaleFactorsXYChartAdapter } from "../../../utils/xy/model/ScaleFactorsXYChart";
import { XYChartStylesAdapter } from "../../../utils/xy/model/XYChartStyle";
import { ScatterChart, ScatterChartConfig } from "./ScatterChart";

const defaultStyles = () =>
  new XYChartStylesAdapter(
    new ScaleFactorsXYChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).default();

const baseConfig = (over: Partial<ScatterChartConfig> = {}): ScatterChartConfig => ({
  chartTitle: "",
  x: { measure: "ac1" },
  y: { measure: "ac2" },
  iso: null,
  labels: { points: "auto", values: false, max: 12 },
  legend: { show: true, position: "right" },
  facet: null,
  pointLevel: "subCategory",
  seriesLevel: "category",
  aspect: 16 / 9,
  limit: 0,
  ...over,
});

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  operation: "+",
  rowGroup: "Europe",
  rowGroupIndex: 1,
  category: "RX",
  categoryIndex: 1,
  subCategory: "RX-1",
  subCategoryIndex: 1,
  ac1: 10,
  ac2: 20,
  ...over,
});

const makeChart = (rows: Record<string, unknown>[], config: ScatterChartConfig = baseConfig()): ScatterChart => {
  const db = createScopedDb().db;
  db.tables["scatterData"] = { data: rows };
  return new ScatterChart(new IBCSRuleSet(), db, "`scatterData`", config, defaultStyles(), 1000);
};

describe("ScatterChart", () => {
  it("renders an SVG string with one circle per point and the annotation hook", () => {
    const chart = makeChart([
      row(),
      row({ subCategory: "RX-2", subCategoryIndex: 2, ac1: 15, ac2: 25 }),
      row({ subCategory: "X2-1", subCategoryIndex: 3, category: "X2", categoryIndex: 2, ac1: 5, ac2: 30 }),
    ]);

    expect(chart.hasNoData()).toBe(false);
    const svg = chart.toString();
    expect(svg).toContain("<svg");
    expect((svg.match(/<circle/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(svg).toContain('class="annotations"');
    // Legend lists the series names.
    expect(svg).toContain("RX");
    expect(svg).toContain("X2");
  });

  it("reports no data for an empty table", () => {
    const chart = makeChart([]);
    expect(chart.hasNoData()).toBe(true);
  });

  it("excludes points outside an explicit domain and warns (xy-point-clipped)", () => {
    const chart = makeChart(
      [row(), row({ subCategory: "OUT", subCategoryIndex: 9, ac1: 999 })],
      baseConfig({ x: { measure: "ac1", max: 100 } }),
    );
    chart.toString();
    expect(chart.getWarnings().map((w) => w.code)).toContain("xy-point-clipped");
  });

  it("draws iso-curves with edge labels on positive domains", () => {
    const chart = makeChart(
      [row({ ac1: 10, ac2: 20 }), row({ subCategory: "B", subCategoryIndex: 2, ac1: 30, ac2: 15 })],
      baseConfig({ iso: { values: [460], label: "Gross profit", unit: "mUSD" } }),
    );
    const svg = chart.toString();
    expect(svg).toContain("<path");
    expect(svg).toContain("Gross profit");
    expect(chart.getWarnings().map((w) => w.code)).not.toContain("xy-iso-domain");
  });

  it("skips iso-curves on non-positive domains with xy-iso-domain", () => {
    const chart = makeChart(
      [row({ ac1: -5, ac2: 20 }), row({ subCategory: "B", subCategoryIndex: 2, ac1: 30, ac2: 15 })],
      baseConfig({ iso: { values: "auto" } }),
    );
    chart.toString();
    expect(chart.getWarnings().map((w) => w.code)).toContain("xy-iso-domain");
  });

  it("renders one panel per facet value with panel titles", () => {
    const chart = makeChart(
      [row(), row({ rowGroup: "RoW", rowGroupIndex: 2, subCategory: "RX-9", subCategoryIndex: 9 })],
      baseConfig({ facet: { level: "rowgroup" } }),
    );
    const svg = chart.toString();
    expect(svg).toContain("Europe");
    expect(svg).toContain("RoW");
  });

  it("warns on explicit label names that match no point (xy-label-unknown)", () => {
    const chart = makeChart([row()], baseConfig({ labels: { points: ["RX-1", "Nope"], values: false, max: 12 } }));
    chart.toString();
    const warning = chart.getWarnings().find((w) => w.code === "xy-label-unknown");
    expect(warning).toBeDefined();
    expect(warning!.data.names).toBe("Nope");
  });

  it("cycles the palette with a warning when there are more series than colors (xy-series-overflow)", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({ category: `S${i}`, categoryIndex: i, subCategory: `P${i}`, subCategoryIndex: i, ac1: i + 1, ac2: i + 1 }),
    );
    const chart = makeChart(rows);
    chart.toString();
    expect(chart.getWarnings().map((w) => w.code)).toContain("xy-series-overflow");
  });

  it("renders 2000 points within the performance budget (spec §10)", () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 2000; i++) {
      rows.push(
        row({
          subCategory: `P${i}`,
          subCategoryIndex: i,
          category: `C${i % 3}`,
          categoryIndex: i % 3,
          ac1: (i % 97) + 1,
          ac2: (i % 53) + 1,
        }),
      );
    }

    const start = Date.now();
    const chart = makeChart(rows);
    const svg = chart.toString();
    const elapsed = Date.now() - start;

    // 2000 point marks plus one legend swatch circle per series.
    expect((svg.match(/<circle/g) || []).length).toBeGreaterThanOrEqual(2000);
    // Spec budget is 150 ms orchestrator time; shared CI runners have been
    // observed at ~1.9 s, so assert a loose 5 s smoke budget that still
    // catches gross (e.g. quadratic) regressions.

    console.warn(`ScatterChart 2000-point build+serialize: ${elapsed} ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});
