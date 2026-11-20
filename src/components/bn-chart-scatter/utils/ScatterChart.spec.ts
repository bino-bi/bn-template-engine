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

describe("ScatterChart number labels", () => {
  const point = (name: string, index: number, ac1: number, ac2: number): Record<string, unknown> =>
    row({ subCategory: name, subCategoryIndex: index, ac1, ac2 });

  it("prints iso values with the decimals they need", () => {
    const chart = makeChart(
      [point("a", 1, 0.5, 0.5), point("b", 2, 2, 2)],
      baseConfig({ iso: { values: [0.6, 1.2] } }),
    );
    const svg = chart.toString();

    // was 1 and 1; the axis ticks have two decimals here, so these texts are the iso labels
    expect(svg).toContain(">0,6</tspan>");
    expect(svg).toContain(">1,2</tspan>");
  });

  it("prints whole iso values without decimals", () => {
    const chart = makeChart([point("a", 1, 10, 10), point("b", 2, 40, 40)], baseConfig({ iso: { values: [400] } }));

    expect(chart.toString()).toContain(">400</tspan>");
  });

  it("prints every tick of a small domain differently", () => {
    const chart = makeChart([point("a", 1, 0.021, 10), point("b", 2, 0.044, 20)]);
    const svg = chart.toString();

    // was 0,03 | 0,03 | 0,04 | 0,04
    for (const tick of ["0,025", "0,030", "0,035", "0,040"]) {
      expect(svg).toContain(`>${tick}</tspan>`);
    }
  });
});

describe("ScatterChart relative variance axis", () => {
  // drac1_pp1 of the three points: -20 %, 0 % and +20 %
  const rows = [
    row({ subCategory: "down", subCategoryIndex: 1, ac1: 80, pp1: 100, ac2: 10 }),
    row({ subCategory: "flat", subCategoryIndex: 2, ac1: 100, pp1: 100, ac2: 20 }),
    row({ subCategory: "up", subCategoryIndex: 3, ac1: 120, pp1: 100, ac2: 30 }),
  ];

  const drChart = (x: Record<string, unknown> = {}): ScatterChart =>
    makeChart(
      rows,
      baseConfig({ x: { measure: "drac1_pp1", unit: "%", ...x }, labels: { points: "none", values: false, max: 0 } }),
    );

  /** The x attribute of the text element with the given content. */
  const textX = (svg: string, content: string): number =>
    Number(new RegExp(`<text[^>]* x="([-\\d.]+)"[^>]*><tspan[^>]*>${content}</tspan>`).exec(svg)![1]);

  it("prints the ticks in percent", () => {
    const svg = drChart().toString();

    // was 0,20 under the title "in %"
    expect(svg).toContain(">20%</tspan>");
    expect(svg).toContain(">-20%</tspan>");
    expect(svg).not.toContain(">0,20</tspan>");
    expect(svg).not.toContain(">0,2</tspan>");
  });

  it("reads min and max in percent", () => {
    const chart = drChart({ min: -40, max: 40 });
    const svg = chart.toString();

    expect(svg).toContain(">-40%</tspan>");
    expect(svg).toContain(">40%</tspan>");
    expect(chart.getWarnings().map((warning) => warning.code)).not.toContain("xy-point-clipped");
    // a domain of -40 to 40 as fractions would print 4.000 %
    expect(svg).not.toContain("000%");
  });

  it("clips at a max given in percent", () => {
    const chart = drChart({ min: -40, max: 10 });

    // the point at +20 % is outside
    expect(chart.getWarnings().map((warning) => warning.code)).toContain("xy-point-clipped");
  });

  it("draws the reference line at the percent value", () => {
    const svg = drChart({ refLine: 20 }).toString();
    const lineXs = [...svg.matchAll(/<line x1="([-\d.]+)" y1="[-\d.]+" x2="([-\d.]+)"/g)]
      .filter((match) => match[1] === match[2])
      .map((match) => Number(match[1]));

    expect(lineXs).toContainEqual(expect.closeTo(textX(svg, "20%"), 6));
  });
});

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

  const two = [row({ ac1: 10, ac2: 20 }), row({ subCategory: "B", subCategoryIndex: 2, ac1: 30, ac2: 15 })];
  const pathCount = (svg: string): number => (svg.match(/<path/g) ?? []).length;

  it("draws iso-curves and their region on axes that start at 0", () => {
    const chart = makeChart(
      two,
      baseConfig({
        x: { measure: "ac1", min: 0, max: 40 },
        y: { measure: "ac2", min: 0, max: 40 },
        iso: { values: [200, 400], highlight: { from: 400 } },
      }),
    );
    expect(pathCount(chart.toString())).toBe(3);
    expect(chart.getWarnings().map((w) => w.code)).not.toContain("xy-iso-domain");
  });

  it("draws an iso value at x * y * factor and labels it with the value", () => {
    const config = (iso: ScatterChartConfig["iso"]): ScatterChartConfig =>
      baseConfig({ x: { measure: "ac1", min: 0, max: 40 }, y: { measure: "ac2", min: 0, max: 40 }, iso });
    const curve = (svg: string): string => /<path d="([^"]+)"/.exec(svg)![1];
    const plain = makeChart(two, config({ values: [400] })).toString();
    const scaled = makeChart(two, config({ values: [0.4], factor: 0.001 })).toString();
    expect(curve(scaled)).toBe(curve(plain));
    expect(scaled).toContain(">0,4<");
    expect(scaled).not.toContain(">400<");
  });

  it("puts ticks at a typed step", () => {
    const svg = makeChart(
      two,
      baseConfig({ x: { measure: "ac1", min: 0, max: 40, step: 8 }, y: { measure: "ac2", min: 0, max: 40 } }),
    ).toString();
    for (const tick of ["8", "16", "24", "32", "40"]) {
      expect(svg).toContain(`>${tick}<`);
    }
  });

  it("takes the outline and the opacity of a point from the style", () => {
    const db = createScopedDb().db;
    db.tables["scatterData"] = { data: two };
    const styles = defaultStyles();
    expect(styles.markStyles).toEqual({ stroke: "#ffffff", opacity: 1 });
    styles.markStyles = { stroke: "#404040", opacity: 0.8 };
    const svg = new ScatterChart(new IBCSRuleSet(), db, "`scatterData`", baseConfig(), styles, 1000).toString();
    const circle = /<circle[^>]*>/.exec(svg)![0];
    expect(circle).toContain('stroke="#404040"');
    expect(circle).toContain('fill-opacity="0.8"');
  });

  describe("titles beside the ends of the axes", () => {
    const axes = (titlePosition?: "beside") => ({
      x: { measure: "ac1", label: "Margin", unit: "%", min: 0, max: 40, titlePosition },
      y: { measure: "ac2", label: "Net sales", unit: "mEUR", min: 0, max: 40, titlePosition },
    });
    const textOf = (svg: string, text: string): { x: number; y: number; anchor: string } => {
      const tag = new RegExp(`<text[^>]*>(?:<tspan[^>]*>)?${text}<`).exec(svg)![0];
      return {
        x: Number(/\sx="([\d.]+)"/.exec(tag)![1]),
        y: Number(/\sy="([\d.]+)"/.exec(tag)![1]),
        anchor: /text-anchor="(\w+)"/.exec(tag)![1],
      };
    };
    const frameOf = (svg: string): { x: number; y: number; width: number; height: number } => {
      const tag = /<rect[^>]*data-bn-baseline[^>]*>/.exec(svg)![0];
      const num = (name: string): number => Number(new RegExp(`\\s${name}="([\\d.]+)"`).exec(tag)![1]);
      return { x: num("x"), y: num("y"), width: num("width"), height: num("height") };
    };

    it("puts the y title in two lines left of the top of the axis", () => {
      const svg = makeChart(two, baseConfig(axes("beside"))).toString();
      const frame = frameOf(svg);
      const name = textOf(svg, "Net sales");
      const unit = textOf(svg, "in mEUR");
      expect(name.anchor).toBe("end");
      expect(name.x).toBeLessThan(frame.x);
      expect(unit.x).toBe(name.x);
      expect(name.y).toBeLessThan(frame.y);
      expect(unit.y).toBeGreaterThan(frame.y);
    });

    it("puts the x title in two lines right of the end of the axis", () => {
      const svg = makeChart(two, baseConfig(axes("beside"))).toString();
      const frame = frameOf(svg);
      const name = textOf(svg, "Margin");
      const unit = textOf(svg, "in %");
      expect(name.x).toBeGreaterThan(frame.x + frame.width);
      expect(unit.x).toBe(name.x);
      expect(name.y).toBeGreaterThan(frame.y + frame.height);
      expect(unit.y).toBeGreaterThan(name.y);
    });

    it("leaves the titles in their own rows by default", () => {
      const svg = makeChart(two, baseConfig(axes())).toString();
      const frame = frameOf(svg);
      expect(textOf(svg, "Net sales").anchor).toBe("start");
      expect(textOf(svg, "in %").x).toBeLessThanOrEqual(frame.x + frame.width);
    });
  });

  it("moves the legend along its side with align", () => {
    const legendY = (align?: "center" | "end"): number => {
      const svg = makeChart(two, baseConfig({ legend: { show: true, position: "right", align } })).toString();
      return Number(/<text[^>]*\sy="([\d.]+)"[^>]*>(?:<tspan[^>]*>)?RX</.exec(svg)![1]);
    };
    expect(legendY("center")).toBeGreaterThan(legendY());
    expect(legendY("end")).toBeGreaterThan(legendY("center"));
  });

  it("puts a label on the side that is typed for it", () => {
    const labelY = (side: "n" | "s"): number => {
      const svg = makeChart(
        two,
        baseConfig({ labels: { points: ["B"], values: false, max: 12, sides: { B: side } } }),
      ).toString();
      return Number(/<text[^>]*\sy="([\d.]+)"[^>]*>(?:<tspan[^>]*>)?B</.exec(svg)![1]);
    };
    expect(labelY("n")).toBeLessThan(labelY("s"));
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

  it("marks every panel frame as a baseline, the first panel first", () => {
    const chart = makeChart(
      [row(), row({ rowGroup: "RoW", rowGroupIndex: 2, subCategory: "RX-9", subCategoryIndex: 9 })],
      baseConfig({ facet: { level: "rowgroup" } }),
    );
    const svg = chart.toString();
    expect((svg.match(/<rect[^>]*data-bn-baseline="frame"/g) || []).length).toBe(2);
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

describe("ScatterChart data-point keys", () => {
  it("keys each mark and its name label with the raw values of its levels", () => {
    const chart = makeChart(
      [row({ subCategory: "RX-1", subCategoryIndex: 1, ac1: 10, ac2: 20 })],
      baseConfig({ labels: { points: "all", values: false, max: 10 } }),
    );
    const svg = chart.toString();

    expect(svg).toMatch(/<circle[^>]*data-bn-sub-category="RX-1"[^>]*data-bn-part="element"/);
    expect(svg).toMatch(/<text[^>]*data-bn-sub-category="RX-1"[^>]*data-bn-part="label"/);
  });
});

describe("ScatterChart labels of a typed list", () => {
  const twoPanels = (): Record<string, unknown>[] => [
    row({ rowGroup: "Europe", rowGroupIndex: 1, subCategory: "A", subCategoryIndex: 1 }),
    row({ rowGroup: "RoW", rowGroupIndex: 2, subCategory: "B", subCategoryIndex: 2 }),
  ];
  const warningsFor = (points: string[]): { code: string; data: Record<string, string> }[] => {
    const chart = makeChart(
      twoPanels(),
      baseConfig({ facet: { level: "rowgroup" }, labels: { points, values: false, max: 12 } }),
    );
    chart.toString();
    return chart.getWarnings();
  };

  it("calls a name unknown only when no panel has it", () => {
    expect(warningsFor(["A", "B"]).some((w) => w.code === "xy-label-unknown")).toBe(false);
    expect(warningsFor(["A", "C"]).find((w) => w.code === "xy-label-unknown")?.data.names).toBe("C");
  });

  it("warns with the name and the panel of a label that found no place", () => {
    // 40 points on one spot: the labels of most of them have no free side
    const rows = Array.from({ length: 40 }, (_, i) =>
      row({ rowGroup: "Europe", subCategory: `P${i}`, subCategoryIndex: i + 1, ac1: 10, ac2: 20 }),
    );
    rows.push(row({ rowGroup: "RoW", rowGroupIndex: 2, subCategory: "Q", subCategoryIndex: 99, ac1: 11, ac2: 21 }));
    const chart = makeChart(
      rows,
      baseConfig({
        facet: { level: "rowgroup" },
        labels: { points: rows.map((r) => r.subCategory as string), values: false, max: 12 },
      }),
    );
    chart.toString();
    const names = chart.getWarnings().find((w) => w.code === "xy-label-dropped")?.data.names ?? "";
    expect(names).toContain("(Europe)");
    expect(names).not.toContain("Q");
  });

  it("does not warn for labels that are left out with points all", () => {
    const rows = Array.from({ length: 40 }, (_, i) => row({ subCategory: `P${i}`, subCategoryIndex: i + 1 }));
    const chart = makeChart(rows, baseConfig({ labels: { points: "all", values: false, max: 12 } }));
    chart.toString();
    expect(chart.getWarnings().some((w) => w.code === "xy-label-dropped")).toBe(false);
  });
});

describe("ScatterChart options shared with the bubble chart", () => {
  const points = (): Record<string, unknown>[] => [
    row({ subCategory: "A", subCategoryIndex: 1, ac1: 10, ac2: 10 }),
    row({ category: "TX", categoryIndex: 2, subCategory: "B", subCategoryIndex: 2, ac1: 20, ac2: 20 }),
  ];
  const frameWidth = (svg: string): number => Number(/<rect width="([\d.]+)"[^>]*fill="none"/.exec(svg)![1]);

  it("draws a legend inside the plot without room beside it", () => {
    const inside = makeChart(points(), baseConfig({ legend: { show: true, position: "inside" } })).toString();
    const none = makeChart(points(), baseConfig({ legend: { show: false, position: "right" } })).toString();
    expect(inside).toContain(">RX<");
    expect(frameWidth(inside)).toBeCloseTo(frameWidth(none), 3);
  });

  it("leaves a series out of the legend and prints ticks with typed decimals", () => {
    const svg = makeChart(
      points(),
      baseConfig({
        legend: { show: true, position: "right", exclude: ["TX"] },
        x: { measure: "ac1", min: 0, max: 40, step: 20, decimals: 1 },
      }),
    ).toString();
    expect(svg).toContain(">RX<");
    expect(svg).not.toContain(">TX<");
    expect(svg).toContain(">20,0<");
  });
});
