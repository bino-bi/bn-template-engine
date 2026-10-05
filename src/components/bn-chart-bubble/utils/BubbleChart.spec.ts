import { createScopedDb } from "../../../context/scopedDb";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { FontStyleAdapter } from "../../../utils/model/styles/FontStyle";
import { PaddingAdapter } from "../../../utils/model/styles/Padding";
import { SVGStyleAdapter } from "../../../utils/model/styles/SVGStyle";
import { SVGStyleGroupAdapter } from "../../../utils/model/styles/SVGStyleGroup";
import { shade, XY_SERIES_PALETTE } from "../../../utils/xy/SeriesPalette";
import { ScaleFactorsXYChartAdapter } from "../../../utils/xy/model/ScaleFactorsXYChart";
import { XYChartStylesAdapter } from "../../../utils/xy/model/XYChartStyle";
import { BubbleChart, BubbleChartConfig } from "./BubbleChart";

const defaultStyles = () =>
  new XYChartStylesAdapter(
    new ScaleFactorsXYChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).default();

const baseConfig = (over: Partial<BubbleChartConfig> = {}): BubbleChartConfig => ({
  chartTitle: "",
  x: { measure: "ac1" },
  y: { measure: "ac2" },
  size: { measure: "ac3" },
  share: null,
  compareFamily: null,
  labels: { points: "all", values: true, max: 12 },
  legend: { show: true, position: "right" },
  facet: null,
  pointLevel: "subCategory",
  seriesLevel: "category",
  aspect: 16 / 9,
  limit: 0,
  sizeAreaPerUnit: 0,
  ...over,
});

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  operation: "+",
  rowGroup: "SBUs",
  rowGroupIndex: 1,
  category: "Core Business",
  categoryIndex: 1,
  subCategory: "VAB",
  subCategoryIndex: 1,
  ac1: 0.3,
  ac2: 0.1,
  ac3: 32,
  pp1: 0.28,
  pp2: 0.12,
  pp3: 29,
  ...over,
});

const makeChart = (rows: Record<string, unknown>[], config: BubbleChartConfig = baseConfig()): BubbleChart => {
  const db = createScopedDb().db;
  db.tables["bubbleData"] = { data: rows };
  return new BubbleChart(new IBCSRuleSet(), db, "`bubbleData`", config, defaultStyles(), 1000);
};

/** All circle radii in the SVG string. */
const radii = (svg: string): number[] => [...svg.matchAll(/<circle r="([\d.]+)"/g)].map((m) => Number(m[1]));

describe("BubbleChart", () => {
  it("renders bubbles with the value inside and the name above", () => {
    const chart = makeChart([row()]);
    const svg = chart.toString();
    expect(svg).toContain("<circle");
    // Value label, IBCS 1-decimal format (de-DE comma).
    expect(svg).toContain("32,0");
    expect(svg).toContain("VAB");
    expect(svg).toContain('class="annotations"');
  });

  it("formats the value label in the locale of the style", () => {
    const db = createScopedDb().db;
    db.tables["bubbleData"] = { data: [row()] };
    const styles = defaultStyles();
    styles.locale = "en";
    const svg = new BubbleChart(new IBCSRuleSet(), db, "`bubbleData`", baseConfig(), styles, 1000).toString();
    expect(svg).toContain(">32.0</tspan>");
    // axis tick
    expect(svg).toContain(">0.30</tspan>");
  });

  it("draws the size legend caption from the size spec", () => {
    const chart = makeChart([row()], baseConfig({ size: { measure: "ac3", label: "Net sales", unit: "mEUR" } }));
    chart.setI18n(new Map([["axis.in", "in"]]));
    const svg = chart.toString();
    expect(svg).toContain("Net sales");
    expect(svg).toContain("in mEUR");
  });

  it("excludes negative sizes with bubble-size-negative", () => {
    const chart = makeChart([row(), row({ subCategory: "NEG", subCategoryIndex: 2, ac3: -4 })]);
    chart.toString();
    expect(chart.getWarnings().map((w) => w.code)).toContain("bubble-size-negative");
  });

  it("clamps share values outside [0,1] with bubble-share-range", () => {
    const chart = makeChart([row({ ac4: 1.7 })], baseConfig({ share: { measure: "ac4" } }));
    chart.toString();
    expect(chart.getWarnings().map((w) => w.code)).toContain("bubble-share-range");
  });

  describe("comparison overlay (10D)", () => {
    it("draws the comparison group structurally behind the primary group", () => {
      const chart = makeChart([row()], baseConfig({ compareFamily: "pp" }));
      const svg = chart.toString();
      const compareIndex = svg.indexOf('id="compare"');
      const primaryIndex = svg.indexOf('id="primary"');
      expect(compareIndex).toBeGreaterThan(-1);
      expect(primaryIndex).toBeGreaterThan(-1);
      expect(compareIndex).toBeLessThan(primaryIndex);
    });

    it("lists the scenario families in the legend with their rule-set display names", () => {
      // The system default names the pp family "PP" - the 10D "PY" label
      // comes from renaming it via <bn-ruleset> (spec §6.1).
      const chart = makeChart([row()], baseConfig({ compareFamily: "pp" }));
      const svg = chart.toString();
      expect(svg).toContain("PP");
      expect(svg).toContain("AC");
    });

    it("uses renamed scenario display names from a custom rule set", () => {
      const db = createScopedDb().db;
      db.tables["bubbleData"] = { data: [row()] };
      const ruleSet = new IBCSRuleSet({ scenarios: { pp: { name: "PY" } } });
      const chart = new BubbleChart(
        ruleSet,
        db,
        "`bubbleData`",
        baseConfig({ compareFamily: "pp" }),
        defaultStyles(),
        1000,
      );
      expect(chart.toString()).toContain("PY");
    });

    it("renders primary-only when comparison data is missing", () => {
      const chart = makeChart([row({ pp1: null })], baseConfig({ compareFamily: "pp" }));
      const svg = chart.toString();
      expect(svg).toContain('id="compare"');
      // The compare group stays empty: exactly one bubble plus legend swatches.
      const compareSection = svg.slice(svg.indexOf('id="compare"'), svg.indexOf('id="primary"'));
      expect(compareSection).not.toContain("<circle");
    });
  });

  describe("share slices (10E)", () => {
    it("draws a pie sector from 12 o'clock clockwise in the hue's dark shade", () => {
      const chart = makeChart([row({ ac4: 0.25 })], baseConfig({ share: { measure: "ac4" } }));
      const svg = chart.toString();
      const slice = /<path d="M ([\d.]+) ([\d.]+) L \1 ([\d.]+) A ([\d.]+) \4 0 0 1/.exec(svg);
      expect(slice).not.toBeNull();

      const [, , cy, topY, r] = slice!.map(Number as never) as unknown as number[];
      // Starts at 12 o'clock: the first line runs straight up by r.
      expect(Number(cy) - Number(topY)).toBeCloseTo(Number(r), 5);
      // Dark shade of the first series hue.
      expect(svg).toContain(shade(XY_SERIES_PALETTE[0]));
    });

    it("uses the large-arc flag for shares above one half", () => {
      const chart = makeChart([row({ ac4: 0.75 })], baseConfig({ share: { measure: "ac4" } }));
      expect(chart.toString()).toMatch(/A [\d.]+ [\d.]+ 0 1 1/);
    });
  });

  describe("relative variance measures", () => {
    // drac1_pp1: -20 %, 0 % and +20 %. drac3_pp3 of the first row: (32 - 29) / 29 = 10,3 %
    const rows = [
      row({ subCategory: "down", subCategoryIndex: 1, ac1: 80, pp1: 100 }),
      row({ subCategory: "flat", subCategoryIndex: 2, ac1: 100, pp1: 100 }),
      row({ subCategory: "up", subCategoryIndex: 3, ac1: 120, pp1: 100 }),
    ];

    it("prints the ticks of a relative variance axis in percent", () => {
      const svg = makeChart(rows, baseConfig({ x: { measure: "drac1_pp1", min: -40, max: 40 } })).toString();

      expect(svg).toContain(">-40%</tspan>");
      expect(svg).toContain(">20%</tspan>");
      expect(svg).not.toContain(">0,20</tspan>");
    });

    it("prints a relative variance as bubble value in percent", () => {
      const svg = makeChart([row()], baseConfig({ size: { measure: "drac3_pp3" } })).toString();

      // was 0,1
      expect(svg).toContain(">10,3%</tspan>");
    });
  });

  describe("value labels", () => {
    it("prints three significant digits of the largest value", () => {
      // was 0,0
      expect(makeChart([row({ ac3: 0.032 })]).toString()).toContain(">0,0320</tspan>");
      expect(makeChart([row({ ac3: 1234567 })]).toString()).toContain(">1.234.567</tspan>");
    });

    it("hides the value when the bubble is too small to contain it", () => {
      const chart = makeChart(
        [row(), row({ subCategory: "tiny", subCategoryIndex: 2, ac3: 0.0001 })],
        // Grouped mode: the large bubble fits its value, the tiny one cannot.
        baseConfig({ sizeAreaPerUnit: 200 }),
      );
      const svg = chart.toString();
      expect(svg).toContain("32,0");
      expect(svg).not.toContain("0,0001");
    });
  });

  describe("scaling-group mode (§5.4)", () => {
    it("maps value to area via the group constant: r = √(area·v/π)", () => {
      const areaPerUnit = 12;
      const chart = makeChart([row({ ac3: 30 })], baseConfig({ sizeAreaPerUnit: areaPerUnit }));
      const expected = Math.sqrt((areaPerUnit * 30) / Math.PI);
      const match = radii(chart.toString()).some((r) => Math.abs(r - expected) < 1e-6);
      expect(match).toBe(true);
    });

    it("renders overflowing bubbles true-size with bubble-scale-overflow", () => {
      const chart = makeChart([row({ ac3: 1000000 })], baseConfig({ sizeAreaPerUnit: 1000 }));
      chart.toString();
      expect(chart.getWarnings().map((w) => w.code)).toContain("bubble-scale-overflow");
    });
  });

  describe("FC treatment (hatched)", () => {
    it("creates per-series hatch patterns in the chart defs and references them", () => {
      const chart = makeChart(
        [row({ fc1: 0.3, fc2: 0.1, fc3: 32 })],
        baseConfig({ x: { measure: "fc1" }, y: { measure: "fc2" }, size: { measure: "fc3" } }),
      );
      const svg = chart.toString();
      expect(svg).toContain('id="xy-fc-0"');
      expect(svg).toContain("url(");
    });
  });
});
