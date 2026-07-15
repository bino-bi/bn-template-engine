import { DateTime } from "luxon";
import { CompareUtil } from "../../helper/CompareUtil";
import { IAdapter } from "../../helper/IAdapter";
import { MeasureRef, scenarioSlotNumber } from "../VarianceMeasure";

/**
 * IBCS-compliant data row for XY (scatter/bubble) chart visualizations.
 *
 * Same schema as {@link StructureChartDataRow}: the full dimension hierarchy
 * plus the 16 scenario value slots. `date` is parsed but unused (reserved),
 * there are no `setName` semantics. `_`-prefixed passthrough columns are
 * retained on the row (engine convention) but unused by v1 rendering;
 * `<slot>_cnt` columns feed the variance no-data rule.
 */
export class XYChartDataRow {
  public date?: DateTime | null | undefined;
  public operation: string = "+";
  public rowGroup: string | null | undefined;
  public rowGroupIndex: number | null | undefined;
  public category: string | null | undefined;
  public categoryIndex: number | null | undefined;
  public subCategory: string | null | undefined;
  public subCategoryIndex: number | null | undefined;
  public columnGroup: string | null | undefined;
  public columnGroupIndex: number | null | undefined;
  public columnSubGroup: string | null | undefined;
  public columnSubGroupIndex: number | null | undefined;
  public ac1: number | null | undefined;
  public ac2: number | null | undefined;
  public ac3: number | null | undefined;
  public ac4: number | null | undefined;
  public pp1: number | null | undefined;
  public pp2: number | null | undefined;
  public pp3: number | null | undefined;
  public pp4: number | null | undefined;
  public fc1: number | null | undefined;
  public fc2: number | null | undefined;
  public fc3: number | null | undefined;
  public fc4: number | null | undefined;
  public pl1: number | null | undefined;
  public pl2: number | null | undefined;
  public pl3: number | null | undefined;
  public pl4: number | null | undefined;
  /** `_`-prefixed passthrough columns, retained but unused by v1 rendering. */
  public custom: Record<string, unknown> = {};
  /** `<slot>_cnt` columns: non-null value counts used by the variance no-data rule. */
  public counts: Record<string, number> = {};

  constructor() {}

  /** Value of a scenario slot, `null`-normalized. */
  public slotValue(slot: string): number | null {
    const value = this[slot as keyof XYChartDataRow];
    return CompareUtil.isNumber(value) ? value : null;
  }

  /** True when the slot's `_cnt` column reports zero non-null source values. */
  public slotHasNoData(slot: string): boolean {
    return this.counts[slot] === 0;
  }
}

const SCENARIO_SLOTS = [
  "ac1",
  "ac2",
  "ac3",
  "ac4",
  "pp1",
  "pp2",
  "pp3",
  "pp4",
  "fc1",
  "fc2",
  "fc3",
  "fc4",
  "pl1",
  "pl2",
  "pl3",
  "pl4",
] as const;

/**
 * Converts untyped JSON records into validated {@link XYChartDataRow}
 * instances. Only assigns fields that pass {@link CompareUtil} type guards,
 * so malformed input data is silently dropped and defaults are preserved.
 */
export class XYChartDataRowAdapter implements IAdapter<XYChartDataRow> {
  adapt(data: Record<string, unknown>): XYChartDataRow {
    const row = new XYChartDataRow();

    if (CompareUtil.isOperator(data.operation)) {
      row.operation = data.operation;
    }

    if (CompareUtil.isString(data.date)) {
      const parsed = DateTime.fromISO(data.date);
      row.date = parsed.isValid ? parsed : undefined;
    }

    if (CompareUtil.isString(data.rowGroup) && CompareUtil.isNumber(data.rowGroupIndex)) {
      row.rowGroup = data.rowGroup;
      row.rowGroupIndex = data.rowGroupIndex;
    }

    if (CompareUtil.isString(data.category) && CompareUtil.isNumber(data.categoryIndex)) {
      row.category = data.category;
      row.categoryIndex = data.categoryIndex;
    }

    if (CompareUtil.isString(data.subCategory) && CompareUtil.isNumber(data.subCategoryIndex)) {
      row.subCategory = data.subCategory;
      row.subCategoryIndex = data.subCategoryIndex;
    }

    if (CompareUtil.isString(data.columnGroup) && CompareUtil.isNumber(data.columnGroupIndex)) {
      row.columnGroup = data.columnGroup;
      row.columnGroupIndex = data.columnGroupIndex;
    }

    if (CompareUtil.isString(data.columnSubGroup) && CompareUtil.isNumber(data.columnSubGroupIndex)) {
      row.columnSubGroup = data.columnSubGroup;
      row.columnSubGroupIndex = data.columnSubGroupIndex;
    }

    for (const slot of SCENARIO_SLOTS) {
      if (CompareUtil.isNumber(data[slot])) {
        row[slot] = data[slot] as number;
      }
      const cnt = data[`${slot}_cnt`];
      if (CompareUtil.isNumber(cnt)) {
        row.counts[slot] = cnt;
      }
    }

    for (const key of Object.keys(data)) {
      if (key.startsWith("_")) {
        row.custom[key] = data[key];
      }
    }

    return row;
  }

  default(): XYChartDataRow {
    return new XYChartDataRow();
  }
}

/** Hierarchy level a point identity can live on. */
export type PointLevel = "rowGroup" | "category" | "subCategory";
/** Hierarchy level series/facets can live on. */
export type GroupLevel = "rowGroup" | "category";

/** The measures mapped onto the chart. */
export interface XYMeasures {
  x: MeasureRef;
  y: MeasureRef;
  size?: MeasureRef;
  share?: MeasureRef;
}

export interface XYResolveOptions {
  pointLevel: PointLevel;
  /** `null` = single series. */
  seriesLevel: GroupLevel | null;
  /** `null` = no facet panels. */
  facetLevel: GroupLevel | null;
  measures: XYMeasures;
  /** Comparison scenario family (bubble `compareWith`), e.g. `"pp"`. */
  compareFamily?: string | null;
  /** Explicit axis domain overrides; points outside are excluded. */
  domains?: { x?: { min?: number; max?: number }; y?: { min?: number; max?: number } };
  /** 0 = unlimited; applies per facet panel. */
  limit: number;
  /** `"size"`: top-N by size (bubble); `"order"`: first N rows (scatter). */
  limitBy: "size" | "order";
}

/** Comparison-scenario values of a point (same slot numbers, other family). */
export interface XYComparePoint {
  x: number;
  y: number;
  size?: number;
}

/** One resolved, renderable point. */
export interface XYPoint {
  name: string;
  seriesKey: string;
  facetKey: string;
  x: number;
  y: number;
  size?: number;
  share?: number;
  compare?: XYComparePoint | null;
  row: XYChartDataRow;
}

export interface XYSeries {
  key: string;
  /** Order rank (0-based) following the series level's `*Index` sort keys. */
  index: number;
}

export interface XYFacet {
  key: string;
  points: XYPoint[];
}

export interface XYWarningRecord {
  code: string;
  data: Record<string, string>;
}

export interface XYExtents {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Max size value across primary and comparison sets (shared bubble scale). */
  sizeMax: number;
}

export interface ResolvedXYData {
  /** Facet panels ordered by the facet level's `*Index`. Single unnamed facet when no facet level. */
  facets: XYFacet[];
  /** Series ordered by the series level's `*Index`. Single unnamed series when no series level. */
  series: XYSeries[];
  /** `null` when there are no points. */
  extents: XYExtents | null;
  warnings: XYWarningRecord[];
  totalPoints: number;
}

/** Points above this budget raise the `xy-point-budget` warning (spec §10). */
export const XY_POINT_BUDGET = 5000;

const INDEX_FIELD: Record<string, "rowGroupIndex" | "categoryIndex" | "subCategoryIndex"> = {
  rowGroup: "rowGroupIndex",
  category: "categoryIndex",
  subCategory: "subCategoryIndex",
};

interface MeasureEvaluation {
  value: number | null;
  varianceNoData: boolean;
}

function evaluateMeasure(row: XYChartDataRow, ref: MeasureRef): MeasureEvaluation {
  if (ref.kind === "scenario") {
    return { value: row.slotValue(ref.slot), varianceNoData: false };
  }

  if (row.slotHasNoData(ref.measure.base) || row.slotHasNoData(ref.measure.delta)) {
    return { value: null, varianceNoData: true };
  }

  const value = ref.measure.compute(row.slotValue(ref.measure.base), row.slotValue(ref.measure.delta));
  return { value, varianceNoData: value === null };
}

function outsideDomain(value: number, domain?: { min?: number; max?: number }): boolean {
  if (domain === undefined) {
    return false;
  }
  if (domain.min !== undefined && value < domain.min) {
    return true;
  }
  if (domain.max !== undefined && value > domain.max) {
    return true;
  }
  return false;
}

function compareSlot(ref: MeasureRef, family: string): string | null {
  if (ref.kind !== "scenario") {
    return null;
  }
  return family + scenarioSlotNumber(ref.slot);
}

/**
 * Resolves adapted rows into facets, series, and renderable points —
 * the shared data pipeline of both XY orchestrators.
 *
 * One row = one point. Duplicate identities (same facet + point name) keep
 * the first row (deterministic) and raise `xy-duplicate-point`. There is no
 * implicit aggregation — axes are frequently ratios where SUM is wrong; the
 * DataSet SQL is the aggregation surface.
 */
export function resolveXYData(rows: XYChartDataRow[], opts: XYResolveOptions): ResolvedXYData {
  const warnings: XYWarningRecord[] = [];
  const seenKeys = new Set<string>();
  const duplicateNames: string[] = [];
  let duplicateCount = 0;
  let varianceNoDataCount = 0;
  let clippedCount = 0;
  let sizeNegativeCount = 0;
  let shareClampCount = 0;

  const facetOrder = new Map<string, number>();
  const seriesOrder = new Map<string, number>();
  const facetPoints = new Map<string, XYPoint[]>();

  const compareFamily = opts.compareFamily ?? null;
  const compareX = compareFamily !== null ? compareSlot(opts.measures.x, compareFamily) : null;
  const compareY = compareFamily !== null ? compareSlot(opts.measures.y, compareFamily) : null;
  const compareSize =
    compareFamily !== null && opts.measures.size !== undefined ? compareSlot(opts.measures.size, compareFamily) : null;

  for (const row of rows) {
    const name = row[opts.pointLevel];
    if (name == null || name === "") {
      continue;
    }

    const facetKey = (opts.facetLevel !== null ? row[opts.facetLevel] : "") ?? "";
    const seriesKey = (opts.seriesLevel !== null ? row[opts.seriesLevel] : "") ?? "";

    const identity = `${facetKey} ${name}`;
    if (seenKeys.has(identity)) {
      duplicateCount++;
      if (duplicateNames.length < 5 && !duplicateNames.includes(name)) {
        duplicateNames.push(name);
      }
      continue;
    }

    const xEval = evaluateMeasure(row, opts.measures.x);
    const yEval = evaluateMeasure(row, opts.measures.y);
    if (xEval.value === null || yEval.value === null) {
      if (xEval.varianceNoData || yEval.varianceNoData) {
        varianceNoDataCount++;
      }
      continue;
    }

    if (outsideDomain(xEval.value, opts.domains?.x) || outsideDomain(yEval.value, opts.domains?.y)) {
      clippedCount++;
      continue;
    }

    const point: XYPoint = {
      name,
      seriesKey,
      facetKey,
      x: xEval.value,
      y: yEval.value,
      row,
    };

    if (opts.measures.size !== undefined) {
      const sizeValue = evaluateMeasure(row, opts.measures.size).value;
      if (sizeValue === null) {
        continue;
      }
      if (sizeValue < 0) {
        sizeNegativeCount++;
        continue;
      }
      point.size = sizeValue;
    }

    if (opts.measures.share !== undefined) {
      const shareValue = evaluateMeasure(row, opts.measures.share).value;
      if (shareValue !== null) {
        if (shareValue < 0 || shareValue > 1) {
          shareClampCount++;
          point.share = Math.min(1, Math.max(0, shareValue));
        } else {
          point.share = shareValue;
        }
      }
    }

    if (compareX !== null && compareY !== null) {
      const cx = row.slotValue(compareX);
      const cy = row.slotValue(compareY);
      const cSize = compareSize !== null ? row.slotValue(compareSize) : null;
      const sizeMissing = compareSize !== null && cSize === null;

      if (cx !== null && cy !== null && !sizeMissing) {
        if (outsideDomain(cx, opts.domains?.x) || outsideDomain(cy, opts.domains?.y)) {
          clippedCount++;
          point.compare = null;
        } else {
          point.compare = { x: cx, y: cy };
          if (cSize !== null) {
            point.compare.size = cSize;
          }
        }
      } else {
        point.compare = null;
      }
    }

    seenKeys.add(identity);

    if (!facetPoints.has(facetKey)) {
      facetPoints.set(facetKey, []);
    }
    facetPoints.get(facetKey)!.push(point);

    if (opts.facetLevel !== null) {
      const facetIndex = row[INDEX_FIELD[opts.facetLevel]];
      if (facetIndex != null && facetIndex < (facetOrder.get(facetKey) ?? Number.POSITIVE_INFINITY)) {
        facetOrder.set(facetKey, facetIndex);
      }
    }

    if (opts.seriesLevel !== null) {
      const seriesIndex = row[INDEX_FIELD[opts.seriesLevel]];
      if (seriesIndex != null && seriesIndex < (seriesOrder.get(seriesKey) ?? Number.POSITIVE_INFINITY)) {
        seriesOrder.set(seriesKey, seriesIndex);
      }
    }
  }

  const facetKeys = [...facetPoints.keys()].sort(
    (a, b) => (facetOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (facetOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
  );

  const facets: XYFacet[] = facetKeys.map((key) => {
    let points = facetPoints.get(key)!;
    if (opts.limit > 0 && points.length > opts.limit) {
      if (opts.limitBy === "size") {
        points = [...points].sort((a, b) => (b.size ?? 0) - (a.size ?? 0)).slice(0, opts.limit);
      } else {
        points = points.slice(0, opts.limit);
      }
    }
    return { key, points };
  });

  const seriesKeys = new Set<string>();
  for (const facet of facets) {
    for (const point of facet.points) {
      seriesKeys.add(point.seriesKey);
    }
  }
  const series: XYSeries[] = [...seriesKeys]
    .sort((a, b) => (seriesOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (seriesOrder.get(b) ?? Number.MAX_SAFE_INTEGER))
    .map((key, index) => ({ key, index }));

  let extents: XYExtents | null = null;
  let totalPoints = 0;
  for (const facet of facets) {
    for (const point of facet.points) {
      totalPoints++;
      const xs = [point.x];
      const ys = [point.y];
      const sizes = point.size !== undefined ? [point.size] : [];
      if (point.compare != null) {
        xs.push(point.compare.x);
        ys.push(point.compare.y);
        if (point.compare.size !== undefined) {
          sizes.push(point.compare.size);
        }
      }
      if (extents === null) {
        extents = { xMin: xs[0], xMax: xs[0], yMin: ys[0], yMax: ys[0], sizeMax: 0 };
      }
      for (const x of xs) {
        extents.xMin = Math.min(extents.xMin, x);
        extents.xMax = Math.max(extents.xMax, x);
      }
      for (const y of ys) {
        extents.yMin = Math.min(extents.yMin, y);
        extents.yMax = Math.max(extents.yMax, y);
      }
      for (const size of sizes) {
        extents.sizeMax = Math.max(extents.sizeMax, size);
      }
    }
  }

  if (duplicateCount > 0) {
    warnings.push({
      code: "xy-duplicate-point",
      data: { count: String(duplicateCount), names: duplicateNames.join(", ") },
    });
  }
  if (varianceNoDataCount > 0) {
    warnings.push({ code: "xy-variance-nodata", data: { count: String(varianceNoDataCount) } });
  }
  if (clippedCount > 0) {
    warnings.push({ code: "xy-point-clipped", data: { count: String(clippedCount) } });
  }
  if (sizeNegativeCount > 0) {
    warnings.push({ code: "bubble-size-negative", data: { count: String(sizeNegativeCount) } });
  }
  if (shareClampCount > 0) {
    warnings.push({ code: "bubble-share-range", data: { count: String(shareClampCount) } });
  }
  if (totalPoints > XY_POINT_BUDGET) {
    warnings.push({ code: "xy-point-budget", data: { count: String(totalPoints) } });
  }

  return { facets, series, extents, warnings, totalPoints };
}
