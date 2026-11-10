import { TableRowType, TableType } from "../model";
import { QueryColumnNames } from "../../../../utils/model";
import { DataQueryResultRow } from "../../../../utils/model/DataQueryResultRow";

/**
 * Role of a row inside the waterfall cascade.
 * - `cascade`: regular data row offset by the running total
 * - `anchor`: sum/subtotal row anchored at zero
 * - `thereof`: drill row decomposing its parent bar (absolute values)
 * - `partof`: drill row decomposing its parent bar (fractional shares)
 */
export type WaterfallRowKind = "cascade" | "anchor" | "thereof" | "partof";

/** Waterfall bar geometry for a single cell, all coordinates in value units. */
export interface WaterfallBarData {
  /** Coordinate where the bar begins. */
  start: number;
  /** Coordinate where the bar ends; `end - start` is the signed contribution. */
  end: number;
  /** Column-wide minimum coordinate (<= 0), shared by all rows of the column. */
  min: number;
  /** Column-wide maximum coordinate (>= 0), shared by all rows of the column. */
  max: number;
  kind: WaterfallRowKind;
  /** Parent bar start, only set for thereof/partof rows (dashed extent guides). */
  parentStart?: number;
  /** Parent bar end, only set for thereof/partof rows (dashed extent guides). */
  parentEnd?: number;
}

/**
 * Waterfall geometry per raw result row and column, keyed by row identity
 * (the factory iterates the same row objects the calculator walked).
 */
export class WaterfallResult {
  private readonly geometry = new Map<DataQueryResultRow, Map<string, WaterfallBarData>>();

  public set(row: DataQueryResultRow, column: string, data: WaterfallBarData): void {
    let columns = this.geometry.get(row);
    if (!columns) {
      columns = new Map<string, WaterfallBarData>();
      this.geometry.set(row, columns);
    }
    columns.set(column, data);
  }

  public get(row: DataQueryResultRow, column: string): WaterfallBarData | undefined {
    return this.geometry.get(row)?.get(column);
  }
}

/** True when the result contains grouping structure (sum, subtotal, or drill rows). */
export function hasGroupingStructure(queryData: DataQueryResultRow[][]): boolean {
  for (const groupData of queryData) {
    for (const row of groupData) {
      const type = row[QueryColumnNames.TYPE];
      if (
        type === TableRowType.SUM ||
        type === TableRowType.GROUPSUM ||
        type === TableRowType.DRILLELEMENT ||
        type === TableRowType.PARTELEMENT
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Signed waterfall contribution of a row for one column.
 *
 * Non-OPT table types aggregate `SUM(scn * transformOperator(operation))`, so ENTRY
 * values arrive already signed. OPT types aggregate plain `SUM(scn)` with the sign
 * carried in the visible operation column, so the sign is applied here. Sum rows are
 * fully signed in both modes.
 */
function signedValue(row: DataQueryResultRow, column: string, tableType: TableType): number | null {
  const raw = row[column];
  if (raw === null || raw === undefined) {
    return null;
  }

  const value = Number(raw);
  if (isNaN(value)) {
    return null;
  }

  const isOpt = tableType === TableType.OPT || tableType === TableType.OPTNOTOTAL;
  if (isOpt && row[QueryColumnNames.TYPE] === TableRowType.ENTRY && row[QueryColumnNames.OPERATION] === "-") {
    return -value;
  }

  return value;
}

/**
 * Computes waterfall bar geometry for the given scenario columns by walking the
 * segmented query result once per column in display order.
 *
 * - ENTRY rows (incl. REST) cascade from the running total by their signed value.
 * - SUM / GROUP_SUM rows anchor at zero and reset the running total to their value.
 * - DRILLELEMENT (thereof) rows form a sub-cascade from their parent bar's start in
 *   the parent's direction; the running total is untouched.
 * - PARTELEMENT (partof) rows cascade a `share * parent width` segment the same way.
 *   Note: the share denominator is the group sum (or SUM_TOTAL when ungrouped) per
 *   `createPartOfDrillRows`, not literally the parent row's value.
 * - GROUPHEAD rows get no bar and restart the running total at zero: every row group
 *   is its own cascade that ends at its GROUP_SUM.
 * - NaN rows get no bar; a NaN parent orphans its drill children.
 *
 * @param queryData - Segmented result rows from DataQuery.execute().
 * @param columns - Plain scenario column keys (ac1..pl4); no `##` composite keys.
 * @param tableType - Table aggregation mode, needed for OPT sign handling.
 */
export function computeWaterfall(
  queryData: DataQueryResultRow[][],
  columns: string[],
  tableType: TableType,
): WaterfallResult {
  const result = new WaterfallResult();

  for (const column of columns) {
    let running = 0;
    let lastParent: { start: number; end: number } | undefined;
    let subCursor = 0;
    const emitted: WaterfallBarData[] = [];

    const emit = (row: DataQueryResultRow, data: WaterfallBarData) => {
      emitted.push(data);
      result.set(row, column, data);
    };

    for (const groupData of queryData) {
      for (const row of groupData) {
        const type = row[QueryColumnNames.TYPE];

        if (type === TableRowType.GROUPHEAD) {
          // a group sum only totals its own rows, so the cascade must not carry over
          running = 0;
          lastParent = undefined;
          continue;
        }

        const value = signedValue(row, column, tableType);

        if (type === TableRowType.ENTRY) {
          if (value === null) {
            lastParent = undefined;
            continue;
          }
          emit(row, { start: running, end: running + value, min: 0, max: 0, kind: "cascade" });
          lastParent = { start: running, end: running + value };
          subCursor = lastParent.start;
          running += value;
        } else if (type === TableRowType.SUM || type === TableRowType.GROUPSUM) {
          if (value === null) {
            lastParent = undefined;
            continue;
          }
          emit(row, { start: 0, end: value, min: 0, max: 0, kind: "anchor" });
          lastParent = { start: 0, end: value };
          subCursor = 0;
          running = value;
        } else if (type === TableRowType.DRILLELEMENT) {
          if (value === null || lastParent === undefined) {
            continue;
          }
          const direction = Math.sign(lastParent.end - lastParent.start) || 1;
          const end = subCursor + direction * Math.abs(value);
          emit(row, {
            start: subCursor,
            end,
            min: 0,
            max: 0,
            kind: "thereof",
            parentStart: lastParent.start,
            parentEnd: lastParent.end,
          });
          subCursor = end;
        } else if (type === TableRowType.PARTELEMENT) {
          if (value === null || lastParent === undefined) {
            continue;
          }
          const end = subCursor + value * (lastParent.end - lastParent.start);
          emit(row, {
            start: subCursor,
            end,
            min: 0,
            max: 0,
            kind: "partof",
            parentStart: lastParent.start,
            parentEnd: lastParent.end,
          });
          subCursor = end;
        }
      }
    }

    // All rows of a column share one coordinate system including zero
    let min = 0;
    let max = 0;
    for (const data of emitted) {
      min = Math.min(min, data.start, data.end);
      max = Math.max(max, data.start, data.end);
    }
    for (const data of emitted) {
      data.min = min;
      data.max = max;
    }
  }

  return result;
}
