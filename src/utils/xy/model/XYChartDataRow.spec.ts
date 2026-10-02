import { resolveMeasure } from "../VarianceMeasure";
import {
  resolveXYData,
  XYChartDataRow,
  XYChartDataRowAdapter,
  XYResolveOptions,
  XY_POINT_BUDGET,
} from "./XYChartDataRow";

const adapter = new XYChartDataRowAdapter();

const rawRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  operation: "+",
  rowGroup: "Europe",
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

const baseOptions = (over: Partial<XYResolveOptions> = {}): XYResolveOptions => ({
  pointLevel: "subCategory",
  seriesLevel: "category",
  facetLevel: null,
  measures: { x: resolveMeasure("ac1")!, y: resolveMeasure("ac2")! },
  limit: 0,
  limitBy: "order",
  ...over,
});

const adaptAll = (rows: Record<string, unknown>[]): XYChartDataRow[] => rows.map((r) => adapter.adapt(r));

describe("XYChartDataRowAdapter", () => {
  it("adapts hierarchy fields and scenario slots", () => {
    const row = adapter.adapt(rawRow());
    expect(row.subCategory).toBe("VAB");
    expect(row.subCategoryIndex).toBe(1);
    expect(row.ac1).toBe(0.3);
    expect(row.pp3).toBe(29);
    expect(row.operation).toBe("+");
  });

  it("drops malformed fields via type guards", () => {
    const row = adapter.adapt(rawRow({ ac1: "not-a-number", operation: "*", category: "X", categoryIndex: "1" }));
    expect(row.ac1).toBeUndefined();
    expect(row.operation).toBe("+");
    // Hierarchy levels need name AND numeric index.
    expect(row.category).toBeUndefined();
  });

  it("retains _-prefixed passthrough columns", () => {
    const row = adapter.adapt(rawRow({ _region: "EMEA", _flag: 1 }));
    expect(row.custom._region).toBe("EMEA");
    expect(row.custom._flag).toBe(1);
  });

  it("captures <slot>_cnt columns for the variance no-data rule", () => {
    const row = adapter.adapt(rawRow({ ac1_cnt: 0, pp1_cnt: 3 }));
    expect(row.slotHasNoData("ac1")).toBe(true);
    expect(row.slotHasNoData("pp1")).toBe(false);
    expect(row.slotHasNoData("fc1")).toBe(false);
  });
});

describe("resolveXYData", () => {
  it("resolves one point per row with series and facet keys", () => {
    const rows = adaptAll([
      rawRow(),
      rawRow({ subCategory: "VBR", subCategoryIndex: 2, category: "New SBUs", categoryIndex: 2, ac1: 0.15, ac2: 0.2 }),
    ]);

    const result = resolveXYData(rows, baseOptions());
    expect(result.totalPoints).toBe(2);
    expect(result.facets).toHaveLength(1);
    expect(result.facets[0].key).toBe("");
    expect(result.series.map((s) => s.key)).toEqual(["Core Business", "New SBUs"]);
    expect(result.facets[0].points[0]).toMatchObject({ name: "VAB", x: 0.3, y: 0.1 });
  });

  it("orders series and facets by their *Index sort keys", () => {
    const rows = adaptAll([
      rawRow({ category: "Zeta", categoryIndex: 5, subCategory: "P1", subCategoryIndex: 1 }),
      rawRow({ category: "Alpha", categoryIndex: 1, subCategory: "P2", subCategoryIndex: 2 }),
      rawRow({ rowGroup: "RoW", rowGroupIndex: 2, subCategory: "P3", subCategoryIndex: 3 }),
      rawRow({ rowGroup: "Europe", rowGroupIndex: 1, subCategory: "P4", subCategoryIndex: 4 }),
    ]);

    const result = resolveXYData(rows, baseOptions({ facetLevel: "rowGroup" }));
    expect(result.series.map((s) => s.key)).toEqual(["Alpha", "Core Business", "Zeta"]);
    expect(result.facets.map((f) => f.key)).toEqual(["Europe", "RoW"]);
  });

  it("keeps the first row on duplicate identities and lists up to 5 offenders", () => {
    const rows = adaptAll([
      rawRow({ ac1: 0.1 }),
      rawRow({ ac1: 0.9 }),
      rawRow({ subCategory: "X2", subCategoryIndex: 2 }),
      rawRow({ subCategory: "X2", subCategoryIndex: 2 }),
    ]);

    const result = resolveXYData(rows, baseOptions());
    expect(result.totalPoints).toBe(2);
    // First row wins - deterministic.
    expect(result.facets[0].points[0].x).toBe(0.1);

    const warning = result.warnings.find((w) => w.code === "xy-duplicate-point");
    expect(warning).toBeDefined();
    expect(warning!.data.count).toBe("2");
    expect(warning!.data.names).toContain("VAB");
    expect(warning!.data.names).toContain("X2");
  });

  it("treats the same point name in different facets as distinct identities", () => {
    const rows = adaptAll([
      rawRow({ rowGroup: "Europe", rowGroupIndex: 1 }),
      rawRow({ rowGroup: "RoW", rowGroupIndex: 2 }),
    ]);

    const result = resolveXYData(rows, baseOptions({ facetLevel: "rowGroup" }));
    expect(result.totalPoints).toBe(2);
    expect(result.warnings.find((w) => w.code === "xy-duplicate-point")).toBeUndefined();
  });

  it("computes variance measures and excludes _cnt-empty rows with a warning", () => {
    const rows = adaptAll([
      rawRow({ ac1: 120, pp1: 100 }),
      rawRow({ subCategory: "X2", subCategoryIndex: 2, ac1: 110, pp1: 100, ac1_cnt: 0 }),
    ]);

    const result = resolveXYData(
      rows,
      baseOptions({ measures: { x: resolveMeasure("drac1_pp1")!, y: resolveMeasure("ac2")! } }),
    );

    expect(result.totalPoints).toBe(1);
    expect(result.facets[0].points[0].x).toBeCloseTo(0.2);
    const warning = result.warnings.find((w) => w.code === "xy-variance-nodata");
    expect(warning).toBeDefined();
    expect(warning!.data.count).toBe("1");
  });

  it("excludes points outside an explicit domain with xy-point-clipped", () => {
    const rows = adaptAll([rawRow({ ac1: 0.3 }), rawRow({ subCategory: "OUT", subCategoryIndex: 9, ac1: 99 })]);

    const result = resolveXYData(rows, baseOptions({ domains: { x: { max: 1 } } }));
    expect(result.totalPoints).toBe(1);
    expect(result.warnings.find((w) => w.code === "xy-point-clipped")!.data.count).toBe("1");
  });

  it("silently skips rows lacking x or y data (no implicit aggregation)", () => {
    const rows = adaptAll([rawRow(), rawRow({ subCategory: "N1", subCategoryIndex: 7, ac2: null })]);
    const result = resolveXYData(rows, baseOptions());
    expect(result.totalPoints).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  describe("size and share (bubble)", () => {
    const bubbleOptions = (over: Partial<XYResolveOptions> = {}) =>
      baseOptions({
        measures: {
          x: resolveMeasure("ac1")!,
          y: resolveMeasure("ac2")!,
          size: resolveMeasure("ac3")!,
          share: resolveMeasure("ac4")!,
        },
        limitBy: "size",
        ...over,
      });

    it("excludes negative sizes with bubble-size-negative", () => {
      const rows = adaptAll([
        rawRow({ ac4: 0.5 }),
        rawRow({ subCategory: "NEG", subCategoryIndex: 2, ac3: -5, ac4: 0.5 }),
      ]);
      const result = resolveXYData(rows, bubbleOptions());
      expect(result.totalPoints).toBe(1);
      expect(result.warnings.find((w) => w.code === "bubble-size-negative")!.data.count).toBe("1");
    });

    it("clamps share values outside [0,1] with bubble-share-range", () => {
      const rows = adaptAll([rawRow({ ac4: 1.4 })]);
      const result = resolveXYData(rows, bubbleOptions());
      expect(result.facets[0].points[0].share).toBe(1);
      expect(result.warnings.find((w) => w.code === "bubble-share-range")!.data.count).toBe("1");
    });

    it("tracks sizeMax across primary and comparison sets", () => {
      const rows = adaptAll([rawRow({ ac3: 20, pp3: 50, ac4: 0.5 })]);
      const result = resolveXYData(rows, bubbleOptions({ compareFamily: "pp" }));
      expect(result.extents!.sizeMax).toBe(50);
    });
  });

  describe("comparison overlay (compareWith)", () => {
    it("reads the same slot numbers from the comparison family", () => {
      const rows = adaptAll([rawRow()]);
      const result = resolveXYData(rows, baseOptions({ compareFamily: "pp" }));
      expect(result.facets[0].points[0].compare).toEqual({ x: 0.28, y: 0.12 });
    });

    it("renders primary-only when comparison data is missing (10D acquisitions)", () => {
      const rows = adaptAll([rawRow({ pp1: null })]);
      const result = resolveXYData(rows, baseOptions({ compareFamily: "pp" }));
      expect(result.facets[0].points[0].compare).toBeNull();
      expect(result.totalPoints).toBe(1);
    });

    it("includes comparison values in the axis extents", () => {
      const rows = adaptAll([rawRow({ ac1: 0.3, pp1: 0.9 })]);
      const result = resolveXYData(rows, baseOptions({ compareFamily: "pp" }));
      expect(result.extents!.xMax).toBe(0.9);
    });
  });

  describe("limit", () => {
    const manyRows = () =>
      adaptAll(
        Array.from({ length: 6 }, (_, i) =>
          rawRow({ subCategory: `P${i}`, subCategoryIndex: i, ac3: i * 10, ac1: i, ac2: i }),
        ),
      );

    it("keeps the first N rows in order mode (scatter)", () => {
      const result = resolveXYData(manyRows(), baseOptions({ limit: 3 }));
      expect(result.facets[0].points.map((p) => p.name)).toEqual(["P0", "P1", "P2"]);
    });

    it("keeps the top N by size in size mode (bubble)", () => {
      const result = resolveXYData(
        manyRows(),
        baseOptions({
          limit: 2,
          limitBy: "size",
          measures: { x: resolveMeasure("ac1")!, y: resolveMeasure("ac2")!, size: resolveMeasure("ac3")! },
        }),
      );
      expect(result.facets[0].points.map((p) => p.name)).toEqual(["P5", "P4"]);
    });

    it("applies the limit per facet panel", () => {
      const rows = adaptAll([
        rawRow({ rowGroup: "A", rowGroupIndex: 1, subCategory: "A1", subCategoryIndex: 1 }),
        rawRow({ rowGroup: "A", rowGroupIndex: 1, subCategory: "A2", subCategoryIndex: 2 }),
        rawRow({ rowGroup: "B", rowGroupIndex: 2, subCategory: "B1", subCategoryIndex: 3 }),
        rawRow({ rowGroup: "B", rowGroupIndex: 2, subCategory: "B2", subCategoryIndex: 4 }),
      ]);
      const result = resolveXYData(rows, baseOptions({ facetLevel: "rowGroup", limit: 1 }));
      expect(result.facets.map((f) => f.points.length)).toEqual([1, 1]);
    });
  });

  it("warns when the point budget is exceeded", () => {
    const rows = adaptAll(
      Array.from({ length: XY_POINT_BUDGET + 1 }, (_, i) =>
        rawRow({ subCategory: `P${i}`, subCategoryIndex: i, ac1: i, ac2: i }),
      ),
    );
    const result = resolveXYData(rows, baseOptions());
    expect(result.totalPoints).toBe(XY_POINT_BUDGET + 1);
    expect(result.warnings.find((w) => w.code === "xy-point-budget")).toBeDefined();
  });

  it("returns null extents for empty data", () => {
    const result = resolveXYData([], baseOptions());
    expect(result.extents).toBeNull();
    expect(result.totalPoints).toBe(0);
  });
});
