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

  describe("legend swatches", () => {
    const circleFills = (family: string): string[] => {
      const chart = makeChart(
        [row({ [`${family}1`]: 0.3, [`${family}2`]: 0.1, [`${family}3`]: 32 })],
        baseConfig({ x: { measure: `${family}1` }, y: { measure: `${family}2` }, size: { measure: `${family}3` } }),
      );
      // the bubble and the legend swatch of its series
      return [...chart.toString().matchAll(/<circle[^>]* fill="([^"]+)"/g)].map((match) => match[1]);
    };

    it("hatches the swatch of a forecast series like its bubbles", () => {
      // the swatch was plain white, the same as for plan
      expect(circleFills("fc")).toEqual(["url(#xy-fc-0)", "url(#xy-fc-0)"]);
    });

    it("keeps the swatch of a plan series white", () => {
      expect(circleFills("pl")).toEqual(["#ffffff", "#ffffff"]);
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

describe("BubbleChart options shared with the scatter chart", () => {
  const rows = (): Record<string, unknown>[] => [
    row({ subCategory: "P1", subCategoryIndex: 1, ac1: 10, ac2: 20, ac3: 30 }),
    row({ subCategory: "P2", subCategoryIndex: 2, ac1: 30, ac2: 15, ac3: 60 }),
  ];
  const chartWith = (config: BubbleChartConfig, style?: (styles: ReturnType<typeof defaultStyles>) => void): string => {
    const db = createScopedDb().db;
    db.tables["bubbleData"] = { data: rows() };
    const styles = defaultStyles();
    style?.(styles);
    return new BubbleChart(new IBCSRuleSet(), db, "`bubbleData`", config, styles, 1000).toString();
  };

  it("puts ticks at a typed step", () => {
    const svg = chartWith(
      baseConfig({ x: { measure: "ac1", min: 0, max: 40, step: 8 }, y: { measure: "ac2", min: 0, max: 40 } }),
    );
    for (const tick of ["8", "16", "24", "32", "40"]) {
      expect(svg).toContain(`>${tick}<`);
    }
  });

  it("takes the outline and the opacity of a bubble from the style", () => {
    const svg = chartWith(baseConfig(), (styles) => (styles.markStyles = { stroke: "#404040", opacity: 0.5 }));
    const circle = /<circle[^>]*>/.exec(svg)![0];
    expect(circle).toContain('stroke="#404040"');
    expect(circle).toContain('fill-opacity="0.5"');
  });

  it("puts a name label on the side that is typed for it", () => {
    const labelY = (side: "n" | "s"): number => {
      const svg = chartWith(baseConfig({ labels: { points: ["P2"], values: false, max: 12, sides: { P2: side } } }));
      return Number(/<text[^>]*\sy="([\d.]+)"[^>]*>(?:<tspan[^>]*>)?P2</.exec(svg)![1]);
    };
    expect(labelY("n")).toBeLessThan(labelY("s"));
  });

  it("prints tick labels and bubble values with the typed decimals", () => {
    const svg = chartWith(
      baseConfig({
        x: { measure: "ac1", min: 0, max: 40, step: 20, decimals: 2 },
        y: { measure: "ac2", min: 0, max: 40 },
        size: { measure: "ac3", decimals: 0 },
      }),
    );
    expect(svg).toContain(">20,00<");
    expect(svg).toContain(">60<");
    expect(svg).not.toContain(">60,0<");
  });

  it("draws a title beside the axis with one line per line of the label", () => {
    const svg = chartWith(
      baseConfig({ y: { measure: "ac2", label: "Relative\nmarket share", unit: "%", titlePosition: "beside" } }),
    );
    const lineY = (text: string): number =>
      Number(new RegExp(`<text[^>]*\\sy="([\\d.]+)"[^>]*>(?:<tspan[^>]*>)?${text}<`).exec(svg)![1]);
    expect(lineY("Relative")).toBeLessThan(lineY("market share"));
    expect(lineY("market share")).toBeLessThan(lineY("in %"));
  });

  it("reads a line break in the label of a title outside the plot as a space", () => {
    const svg = chartWith(baseConfig({ y: { measure: "ac2", label: "Relative\nmarket share" } }));
    expect(svg).toContain(">Relative market share<");
  });

  it("leaves a series out of the legend", () => {
    const withLegend = chartWith(baseConfig());
    const without = chartWith(baseConfig({ legend: { show: true, position: "right", exclude: ["Core Business"] } }));
    expect(withLegend).toContain(">Core Business<");
    expect(without).not.toContain(">Core Business<");
  });

  it("draws a series with the fill outline as a line in its colour, with its value in that colour", () => {
    const svg = chartWith(baseConfig(), (styles) => {
      styles.seriesColors = ["#ff0000"];
      styles.seriesFills = ["outline"];
    });
    const circle = /<circle[^>]*>/.exec(svg)![0];
    expect(circle).toContain('stroke="#ff0000"');
    expect(Number(/fill-opacity="([\d.]+)"/.exec(circle)![1])).toBeLessThan(0.2);
    expect(/<text[^>]*fill="#ff0000"[^>]*>(?:<tspan[^>]*>)?60,0</.test(svg)).toBe(true);
  });

  it("takes the colour of the share slice from the style and gives it the outline of the bubble", () => {
    const db = createScopedDb().db;
    db.tables["bubbleData"] = { data: [row({ ac4: 0.25 })] };
    const styles = defaultStyles();
    styles.shareColors = ["#123456"];
    styles.markStyles = { stroke: "#404040", opacity: 1 };
    const svg = new BubbleChart(
      new IBCSRuleSet(),
      db,
      "`bubbleData`",
      baseConfig({ share: { measure: "ac4" } }),
      styles,
      1000,
    ).toString();
    const slice = /<path[^>]*>/.exec(svg)![0];
    expect(slice).toContain('fill="#123456"');
    expect(slice).toContain('stroke="#404040"');
  });

  it("names the comparison bubble too, but not when it is hidden behind its own bubble", () => {
    const names = (pp: Record<string, number>): number => {
      const db = createScopedDb().db;
      db.tables["bubbleData"] = { data: [row({ ac1: 0.3, ac2: 0.3, ac3: 30, ...pp })] };
      const svg = new BubbleChart(
        new IBCSRuleSet(),
        db,
        "`bubbleData`",
        baseConfig({
          compareFamily: "pp",
          x: { measure: "ac1", min: 0, max: 1 },
          y: { measure: "ac2", min: 0, max: 1 },
        }),
        defaultStyles(),
        1000,
      ).toString();
      return [...svg.matchAll(/>VAB</g)].length;
    };
    expect(names({ pp1: 0.7, pp2: 0.7, pp3: 30 })).toBe(2);
    expect(names({ pp1: 0.3, pp2: 0.3, pp3: 10 })).toBe(1);
  });

  it("is as high as a bubble that hangs below the plot", () => {
    const heightWith = (size: number): number => {
      const db = createScopedDb().db;
      db.tables["bubbleData"] = { data: [row({ ac1: 0.5, ac2: 0, ac3: size })] };
      const chart = new BubbleChart(
        new IBCSRuleSet(),
        db,
        "`bubbleData`",
        baseConfig({
          x: { measure: "ac1", min: 0, max: 1 },
          y: { measure: "ac2", min: 0, max: 1 },
          sizeAreaPerUnit: 100,
        }),
        defaultStyles(),
        1000,
      );
      chart.toString();
      return chart.getAllocatedCanvasHeight();
    };
    // radius 5.6 px and 178 px: the small one fits in the row of the tick labels
    expect(heightWith(1000)).toBeGreaterThan(heightWith(1) + 100);
  });

  it("moves the plot down for a bubble that hangs above it", () => {
    const frameY = (size: number): number => {
      const db = createScopedDb().db;
      db.tables["bubbleData"] = { data: [row({ ac1: 0.5, ac2: 1, ac3: size })] };
      const svg = new BubbleChart(
        new IBCSRuleSet(),
        db,
        "`bubbleData`",
        baseConfig({
          x: { measure: "ac1", min: 0, max: 1 },
          y: { measure: "ac2", min: 0, max: 1 },
          sizeAreaPerUnit: 100,
          labels: { points: "none", values: false, max: 12 },
        }),
        defaultStyles(),
        1000,
      ).toString();
      return Number(/<rect[^>]*\sy="([\d.]+)"[^>]*fill="none"/.exec(svg)![1]);
    };
    // radius 178 px at the top of the y axis
    expect(frameY(1000)).toBeGreaterThan(frameY(1) + 100);
  });

  it("does not break on a share colour list with an empty entry", () => {
    const db = createScopedDb().db;
    db.tables["bubbleData"] = { data: [row({ ac4: 0.25 })] };
    const styles = defaultStyles();
    styles.shareColors = [null as unknown as string];
    const svg = new BubbleChart(
      new IBCSRuleSet(),
      db,
      "`bubbleData`",
      baseConfig({ share: { measure: "ac4" } }),
      styles,
      1000,
    ).toString();
    expect(/<path[^>]*>/.exec(svg)![0]).toContain(`fill="${shade(XY_SERIES_PALETTE[0])}"`);
  });

  it("puts no name on the value of an outlined bubble", () => {
    const db = createScopedDb().db;
    // a small bubble just below the centre of a large outlined one: above it stands the value of the large one
    db.tables["bubbleData"] = {
      data: [
        row({
          category: "Total",
          categoryIndex: 1,
          subCategory: "T",
          subCategoryIndex: 1,
          ac1: 0.5,
          ac2: 0.5,
          ac3: 900,
        }),
        row({ category: "Part", categoryIndex: 2, subCategory: "P", subCategoryIndex: 2, ac1: 0.5, ac2: 0.47, ac3: 1 }),
      ],
    };
    const styles = defaultStyles();
    styles.seriesFills = ["outline"];
    const svg = new BubbleChart(
      new IBCSRuleSet(),
      db,
      "`bubbleData`",
      baseConfig({
        x: { measure: "ac1", min: 0, max: 1 },
        y: { measure: "ac2", min: 0, max: 1 },
        sizeAreaPerUnit: 100,
        labels: { points: ["P"], values: true, max: 12 },
      }),
      styles,
      1000,
    ).toString();
    const box = (text: string): { x: number; y: number } => {
      const tag = new RegExp(`<text[^>]*>(?:<tspan[^>]*>)?${text}<`).exec(svg)![0];
      return { x: Number(/\sx="([\d.]+)"/.exec(tag)![1]), y: Number(/\sy="([\d.]+)"/.exec(tag)![1]) };
    };
    const value = box("900");
    const name = box("P");
    // not in the same row within the width of the value
    expect(Math.abs(name.y - value.y) > 10 || Math.abs(name.x - value.x) > 40).toBe(true);
  });

  describe("value of the share slice", () => {
    const shareChart = (labels: "none" | "all" | string[] | undefined): string => {
      const db = createScopedDb().db;
      db.tables["bubbleData"] = {
        data: [
          row({ subCategory: "A", subCategoryIndex: 1, ac1: 0.3, ac2: 0.3, ac3: 200, ac4: 0.25 }),
          row({ subCategory: "B", subCategoryIndex: 2, ac1: 0.7, ac2: 0.7, ac3: 80, ac4: 0.5 }),
        ],
      };
      return new BubbleChart(
        new IBCSRuleSet(),
        db,
        "`bubbleData`",
        baseConfig({ share: { measure: "ac4", labels }, labels: { points: "none", values: false, max: 12 } }),
        defaultStyles(),
        1000,
      ).toString();
    };

    it("prints none by default", () => {
      expect(shareChart(undefined)).not.toContain(">50<");
    });

    it("prints size times share for the named bubbles", () => {
      const svg = shareChart(["A"]);
      expect(svg).toContain(">50<");
      expect(svg).not.toContain(">40<");
    });

    it("puts the value outside the bubble, right of the middle of the arc of a quarter slice", () => {
      const svg = shareChart(["A"]);
      const label = /<text[^>]*>(?:<tspan[^>]*>)?50</.exec(svg)![0];
      const x = Number(/\sx="([\d.]+)"/.exec(label)![1]);
      const circle = /<circle r="([\d.]+)" cx="([\d.]+)" cy="([\d.]+)"/.exec(svg)!;
      const [r, cx] = [Number(circle[1]), Number(circle[2])];
      // the middle of a quarter slice is at 45 degrees
      expect(x).toBeGreaterThan(cx + r * 0.7);
      expect(x).toBeLessThan(cx + r + 20);
      // drawn after both bubbles, so the smaller one cannot cover it
      const bubbles = [...svg.matchAll(/<circle r="/g)].map((m) => m.index!);
      expect(bubbles[1]).toBeLessThan(svg.indexOf(label));
    });

    it("prints it for all bubbles", () => {
      const svg = shareChart("all");
      expect(svg).toContain(">50<");
      expect(svg).toContain(">40<");
    });
  });

  it("prints a value that is wider than its bubble only with values always", () => {
    const valueShown = (valuesAlways: boolean): boolean => {
      const db = createScopedDb().db;
      db.tables["bubbleData"] = {
        data: [
          row({ subCategory: "Big", subCategoryIndex: 1, ac1: 0.3, ac2: 0.3, ac3: 900 }),
          row({ subCategory: "Small", subCategoryIndex: 2, ac1: 0.7, ac2: 0.7, ac3: 1 }),
        ],
      };
      const svg = new BubbleChart(
        new IBCSRuleSet(),
        db,
        "`bubbleData`",
        baseConfig({ sizeAreaPerUnit: 20, labels: { points: "none", values: true, valuesAlways, max: 12 } }),
        defaultStyles(),
        1000,
      ).toString();
      return svg.includes(">1<");
    };
    expect(valueShown(false)).toBe(false);
    expect(valueShown(true)).toBe(true);
  });

  it("prints the value of a small comparison bubble with values always, unless it is behind its own bubble", () => {
    const compareValue = (valuesAlways: boolean, pp: Record<string, number>): boolean => {
      const db = createScopedDb().db;
      db.tables["bubbleData"] = { data: [row({ ac1: 0.3, ac2: 0.3, ac3: 900, pp3: 2, ...pp })] };
      const svg = new BubbleChart(
        new IBCSRuleSet(),
        db,
        "`bubbleData`",
        baseConfig({
          compareFamily: "pp",
          sizeAreaPerUnit: 20,
          x: { measure: "ac1", min: 0, max: 1 },
          y: { measure: "ac2", min: 0, max: 1 },
          labels: { points: "none", values: true, valuesAlways, max: 12 },
        }),
        defaultStyles(),
        1000,
      ).toString();
      return svg.includes(">2<");
    };
    const away = { pp1: 0.8, pp2: 0.8 };
    expect(compareValue(false, away)).toBe(false);
    expect(compareValue(true, away)).toBe(true);
    expect(compareValue(true, { pp1: 0.3, pp2: 0.3 })).toBe(false);
  });

  it("draws a legend inside the plot and keeps the plot as wide as without a legend", () => {
    const frameWidth = (legend: BubbleChartConfig["legend"]): number =>
      Number(/<rect width="([\d.]+)"[^>]*fill="none"/.exec(chartWith(baseConfig({ legend })))![1]);
    const inside = frameWidth({ show: true, position: "inside" });
    expect(inside).toBeCloseTo(frameWidth({ show: false, position: "right" }), 3);
    expect(inside).toBeGreaterThan(frameWidth({ show: true, position: "right" }));
    expect(chartWith(baseConfig({ legend: { show: true, position: "inside" } }))).toContain(">Core Business<");
  });

  it("leaves out tick labels of the x axis that would run into each other, in even steps", () => {
    const svg = chartWith(
      baseConfig({ x: { measure: "ac1", min: 0, max: 900, step: 20 }, y: { measure: "ac2", min: 0, max: 40 } }),
    );
    const ticks = [...svg.matchAll(/text-anchor="middle"[^>]*>(?:<tspan[^>]*>)?(\d+)</g)].map((m) => Number(m[1]));
    expect(ticks[0]).toBe(0);
    // 46 ticks on less than 1000 px: three digits need more than the 21 px between two of them
    expect(ticks.length).toBeLessThan(46);
    expect(ticks.length).toBeGreaterThan(5);
    const steps = new Set(ticks.slice(1, -1).map((tick, index) => tick - ticks[index]));
    expect(steps.size).toBe(1);
  });

  it("does not move the one series of a chart without a series level behind the names of the style", () => {
    const db = createScopedDb().db;
    db.tables["bubbleData"] = { data: rows() };
    const styles = defaultStyles();
    styles.seriesColors = ["#111111", "#222222"];
    styles.seriesNames = ["A", "B"];
    const chart = new BubbleChart(
      new IBCSRuleSet(),
      db,
      "`bubbleData`",
      baseConfig({ seriesLevel: null }),
      styles,
      1000,
    );
    expect(/<circle[^>]*>/.exec(chart.toString())![0]).toContain('fill="#111111"');
    expect(chart.getWarnings().some((w) => w.code === "xy-series-overflow")).toBe(false);
  });

  it("puts a name on the side that is typed for its panel", () => {
    const db = createScopedDb().db;
    db.tables["bubbleData"] = {
      data: [
        row({ rowGroup: "North", rowGroupIndex: 1, subCategory: "A", subCategoryIndex: 1, ac1: 10, ac2: 10, ac3: 5 }),
        row({ rowGroup: "South", rowGroupIndex: 2, subCategory: "A", subCategoryIndex: 1, ac1: 10, ac2: 10, ac3: 5 }),
      ],
    };
    const svg = new BubbleChart(
      new IBCSRuleSet(),
      db,
      "`bubbleData`",
      baseConfig({
        facet: { level: "rowgroup" },
        x: { measure: "ac1", min: 0, max: 20 },
        y: { measure: "ac2", min: 0, max: 20 },
        labels: { points: ["A"], values: false, max: 12, panelSides: { "South\u0000A": "s" } },
      }),
      defaultStyles(),
      1000,
    ).toString();
    const ys = [...svg.matchAll(/<text[^>]*\sy="([\d.]+)"[^>]*>(?:<tspan[^>]*>)?A</g)].map((m) => Number(m[1]));
    expect(ys).toHaveLength(2);
    // same place of the bubble in both panels: above it in North, below it in South
    expect(ys[1]).toBeGreaterThan(ys[0] + 10);
  });

  it("gives a series the colour that the style names for it", () => {
    const svg = chartWith(baseConfig(), (styles) => {
      styles.seriesColors = ["#111111", "#222222", "#333333"];
      styles.seriesNames = ["Other", "Third", "Core Business"];
    });
    expect(/<circle[^>]*>/.exec(svg)![0]).toContain('fill="#333333"');
  });

  describe("labels in facet panels", () => {
    const facetRows = (): Record<string, unknown>[] => [
      row({ rowGroup: "North", rowGroupIndex: 1, subCategory: "A", subCategoryIndex: 1, ac1: 10, ac2: 10, ac3: 5 }),
      row({ rowGroup: "South", rowGroupIndex: 2, subCategory: "B", subCategoryIndex: 2, ac1: 10, ac2: 10, ac3: 5 }),
    ];
    const facetChart = (points: string[]): BubbleChart => {
      const db = createScopedDb().db;
      db.tables["bubbleData"] = { data: facetRows() };
      const chart = new BubbleChart(
        new IBCSRuleSet(),
        db,
        "`bubbleData`",
        baseConfig({ facet: { level: "rowgroup" }, labels: { points, values: false, max: 12 } }),
        defaultStyles(),
        1000,
      );
      chart.toString();
      return chart;
    };

    it("does not call a name unknown that one panel has", () => {
      expect(
        facetChart(["A", "B"])
          .getWarnings()
          .some((w) => w.code === "xy-label-unknown"),
      ).toBe(false);
    });

    it("calls a name unknown that no panel has", () => {
      const warning = facetChart(["A", "C"])
        .getWarnings()
        .find((w) => w.code === "xy-label-unknown");
      expect(warning?.data.names).toBe("C");
    });
  });
});
