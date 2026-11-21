import { TableRowType, TableType } from "../model";
import { QueryColumnNames } from "../../../../utils/model";
import { DataQueryResultRow } from "../../../../utils/model/DataQueryResultRow";
import { VarianceScenario } from "../../../../utils/model/VarianceScenario";

/**
 * Role of a row inside the waterfall cascade.
 * - `cascade`: regular data row offset by the running total
 * - `anchor`: sum/subtotal row anchored at zero
 * - `thereof`: drill row decomposing its parent bar (absolute values)
 * - `partof`: drill row decomposing its parent bar (fractional shares)
 */
export type WaterfallRowKind = "cascade" | "anchor" | "thereof" | "partof";

/**
 * Connector line of a variance waterfall at a value coordinate: from the row top to the
 * bar, from the bar to the row bottom, or through the whole row.
 */
export interface WaterfallConnector {
  at: number;
  part: "top" | "bottom" | "through";
}

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
  /** Lines that join this bar to the bars of the rows printed above and below. */
  connectors?: WaterfallConnector[];
  /** A scenario drawn inside the bar from its start (`barColumnParts`), in value units. */
  part?: { scenario: string; value: number; end: number };
}

/** A row of a walk with the thereof and partof rows printed beside it. */
interface WalkUnit {
  main: WaterfallBarData;
  /** Thereof rows printed above the row (`thereofPosition: above`). */
  above: WaterfallBarData[];
  /** Thereof rows printed below the row, and partof rows. */
  below: WaterfallBarData[];
  /** A row without a bar is printed above the row, so no line can come in from above. */
  gapAbove: boolean;
  /** A row without a bar is printed below the row, so no line can go on below. */
  gapBelow: boolean;
}

function sameCoordinate(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Sets the connectors of a walk in print order. A null unit is a printed row
 * without a bar. Two rows are joined only where the walk goes on: a group that restarts
 * at zero gets no line from the sum row above it.
 */
function connectWalk(units: (WalkUnit | null)[]): void {
  const add = (bar: WaterfallBarData, at: number, part: WaterfallConnector["part"]) => {
    bar.connectors = [...(bar.connectors ?? []), { at, part }];
  };
  const link = (from: WaterfallBarData, between: WaterfallBarData[], to: WaterfallBarData, at: number) => {
    add(from, at, "bottom");
    between.forEach((bar) => add(bar, at, "through"));
    add(to, at, "top");
  };

  let previous: WalkUnit | null = null;
  for (const unit of units) {
    if (unit === null) {
      previous = null;
      continue;
    }
    const { main, above, below } = unit;
    const chain = (rows: WaterfallBarData[]) =>
      rows.forEach((row, index) => {
        if (index > 0) link(rows[index - 1], [], row, row.start);
      });
    const entry = main.kind === "anchor" ? main.end : main.start;
    if (previous && !unit.gapAbove && sameCoordinate(previous.main.end, entry)) {
      // the line runs beside the rows printed between the two rows
      link(previous.main, [...previous.below, ...above], main, entry);
    }
    if (!unit.gapAbove && above.length > 0) {
      chain(above);
      const last = above[above.length - 1];
      if (sameCoordinate(last.end, main.end)) link(last, [], main, main.end);
    }
    if (!unit.gapBelow && below.length > 0) {
      chain(below);
      link(main, [], below[0], main.start);
    }
    previous = unit.gapBelow ? null : unit;
  }
}

/**
 * Waterfall geometry per raw result row and column, keyed by row identity
 * (the factory iterates the same row objects the calculator walked).
 */
export class WaterfallResult {
  private readonly geometry = new Map<DataQueryResultRow, Map<string, WaterfallBarData>>();
  private readonly columns = new Set<string>();

  public set(row: DataQueryResultRow, column: string, data: WaterfallBarData): void {
    let columns = this.geometry.get(row);
    if (!columns) {
      columns = new Map<string, WaterfallBarData>();
      this.geometry.set(row, columns);
    }
    columns.set(column, data);
    this.columns.add(column);
  }

  public get(row: DataQueryResultRow, column: string): WaterfallBarData | undefined {
    return this.geometry.get(row)?.get(column);
  }

  /** True when the column has waterfall bars, also for a row of it that got none. */
  public has(column: string): boolean {
    return this.columns.has(column);
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
 * Alias of the signed sum of a bar column on the generated REST row of an OPT table. The
 * row prints the unsigned sum of the rows it folds, the walk needs the signed one.
 */
export function restSignedAlias(column: string): string {
  return `${column}__signed`;
}

/** Sign of an OPT entry row; the generated REST row has `restOperation` in place of `operation`. */
function operationSign(row: DataQueryResultRow): number {
  return (row[QueryColumnNames.OPERATION] ?? row.restOperation) === "-" ? -1 : 1;
}

/**
 * Signed waterfall contribution of a row for one column.
 *
 * Non-OPT table types aggregate `SUM(scn * transformOperator(operation))`, so ENTRY
 * values arrive already signed. OPT types aggregate plain `SUM(scn)` with the sign
 * carried in the visible operation column, so the sign is applied here. A REST row that
 * folds "+" and "-" rows has no single sign, it brings its signed sum. Sum rows are
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
  if (isOpt && row[QueryColumnNames.TYPE] === TableRowType.ENTRY) {
    const signed = row[restSignedAlias(column)];
    return typeof signed === "number" ? signed : operationSign(row) * value;
  }

  return value;
}

/**
 * Computes waterfall bar geometry for the given scenario columns by walking the
 * segmented query result once per column in display order.
 *
 * - ENTRY rows (incl. REST) cascade from the running total by their signed value.
 *   The REST row of an OPT table takes the sign of `restOperation`, or its signed sum.
 * - SUM / GROUP_SUM rows anchor at zero. A SUM row resets the running total to its
 *   value, a GROUP_SUM row resets it to zero.
 * - DRILLELEMENT (thereof) rows form a sub-cascade from their parent bar's start in
 *   the parent's direction; the running total is untouched.
 * - PARTELEMENT (partof) rows cascade a `share * parent width` segment the same way.
 *   Note: the share denominator is the group sum (or SUM_TOTAL when ungrouped) per
 *   `createPartOfDrillRows`, not literally the parent row's value.
 * - GROUPHEAD rows get no bar and restart the running total at zero: every row group
 *   is its own cascade that ends at its GROUP_SUM.
 * - With `runningSum` a GROUP_SUM row holds the result of all groups so far, so the
 *   cascade goes on from its value and no GROUPHEAD restarts it.
 * - NaN rows get no bar; a NaN parent orphans its drill children.
 *
 * An absolute variance column walks the same way with two differences: a thereof row
 * steps by its signed value times the operation sign of its parent, so its siblings can
 * go both ways and leave the parent bar; and a partof row gets no bar.
 *
 * The bars of every column carry connectors to the rows printed above and below.
 *
 * @param queryData - Segmented result rows from DataQuery.execute().
 * @param columns - Plain scenario (ac1..pl4) or absolute variance column keys; no `##` composite keys.
 * @param tableType - Table aggregation mode, needed for OPT sign handling.
 * @param runningSum - True when the GROUP_SUM rows are running results.
 * @param thereofAbove - True when thereof rows are printed above their parent; only the connectors depend on it.
 * @param parts - Scenario column to the scenario drawn inside its bars (`barColumnParts`).
 */
export function computeWaterfall(
  queryData: DataQueryResultRow[][],
  columns: string[],
  tableType: TableType,
  runningSum: boolean = false,
  thereofAbove: boolean = false,
  parts: Map<string, string> = new Map(),
): WaterfallResult {
  const result = new WaterfallResult();
  const isOpt = tableType === TableType.OPT || tableType === TableType.OPTNOTOTAL;

  for (const column of columns) {
    const variance = new VarianceScenario(column).isValid;
    let running = 0;
    let lastParent: { start: number; end: number; sign: number } | undefined;
    let subCursor = 0;
    const emitted: WaterfallBarData[] = [];
    const units: (WalkUnit | null)[] = [];
    let unit: WalkUnit | null = null;

    const partScenario = variance ? undefined : parts.get(column);
    const emit = (row: DataQueryResultRow, data: WaterfallBarData) => {
      const partValue = partScenario === undefined ? null : signedValue(row, partScenario, tableType);
      // a partof row holds shares, not values: it gets no part
      if (partScenario !== undefined && partValue !== null && data.kind !== "partof") {
        // the part goes the way of its bar and never beyond its end
        const direction = Math.sign(data.end - data.start) || 1;
        const length = Math.min(Math.abs(partValue), Math.abs(data.end - data.start));
        data.part = { scenario: partScenario, value: Number(row[partScenario]), end: data.start + direction * length };
      }
      emitted.push(data);
      result.set(row, column, data);
      return data;
    };
    const startUnit = (main: WaterfallBarData | null) => {
      unit = main && { main, above: [], below: [], gapAbove: false, gapBelow: false };
      units.push(unit);
    };

    for (const groupData of queryData) {
      for (const row of groupData) {
        const type = row[QueryColumnNames.TYPE];

        if (type === TableRowType.GROUPHEAD) {
          // a group sum only totals its own rows, so the cascade must not carry over
          if (!runningSum) {
            running = 0;
          }
          lastParent = undefined;
          startUnit(null);
          continue;
        }

        const value = signedValue(row, column, tableType);

        if (type === TableRowType.ENTRY) {
          if (value === null) {
            lastParent = undefined;
            startUnit(null);
            continue;
          }
          startUnit(emit(row, { start: running, end: running + value, min: 0, max: 0, kind: "cascade" }));
          // thereof values of an OPT table are unsigned like the entries, so they take the sign of the parent
          const sign = isOpt ? operationSign(row) : 1;
          lastParent = { start: running, end: running + value, sign };
          subCursor = lastParent.start;
          running += value;
        } else if (type === TableRowType.SUM || type === TableRowType.GROUPSUM) {
          if (value === null) {
            lastParent = undefined;
            startUnit(null);
            continue;
          }
          startUnit(emit(row, { start: 0, end: value, min: 0, max: 0, kind: "anchor" }));
          lastParent = { start: 0, end: value, sign: 1 };
          subCursor = 0;
          // a group sum closes its group (there may be no GROUPHEAD row when the title is hidden)
          running = type === TableRowType.GROUPSUM && !runningSum ? 0 : value;
        } else if (variance && (type === TableRowType.DRILLELEMENT || type === TableRowType.PARTELEMENT)) {
          if (type === TableRowType.DRILLELEMENT && value !== null && lastParent !== undefined && unit) {
            const end: number = subCursor + lastParent.sign * value;
            (thereofAbove ? unit.above : unit.below).push(
              emit(row, { start: subCursor, end, min: 0, max: 0, kind: "thereof" }),
            );
            subCursor = end;
          } else if (unit) {
            // only thereof rows move above the parent
            if (thereofAbove && type === TableRowType.DRILLELEMENT) unit.gapAbove = true;
            else unit.gapBelow = true;
          }
        } else if (type === TableRowType.DRILLELEMENT) {
          if (value === null || lastParent === undefined) {
            // a printed row without a bar: no line runs through it
            if (unit) {
              if (thereofAbove) unit.gapAbove = true;
              else unit.gapBelow = true;
            }
            continue;
          }
          const direction = Math.sign(lastParent.end - lastParent.start) || 1;
          const end = subCursor + direction * Math.abs(value);
          const data = emit(row, { start: subCursor, end, min: 0, max: 0, kind: "thereof" });
          if (unit) (thereofAbove ? unit.above : unit.below).push(data);
          subCursor = end;
        } else if (type === TableRowType.PARTELEMENT) {
          if (value === null || lastParent === undefined) {
            if (unit) unit.gapBelow = true;
            continue;
          }
          const end = subCursor + value * (lastParent.end - lastParent.start);
          // partof rows always print below their parent
          const data = emit(row, { start: subCursor, end, min: 0, max: 0, kind: "partof" });
          if (unit) unit.below.push(data);
          subCursor = end;
        }
      }
    }

    connectWalk(units);

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
