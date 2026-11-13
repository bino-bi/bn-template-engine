/**
 * Cell size, span and alignment for bn-grid: the accepted values, their CSS,
 * and the offsets that line up the baselines of the components in a row or column.
 */

export const CELL_SIZES = ["auto", "equal"] as const;
export const VERTICAL_ALIGNS = ["top", "center", "bottom", "baseline"] as const;
export const HORIZONTAL_ALIGNS = ["left", "center", "right", "baseline"] as const;

export type CellSize = (typeof CELL_SIZES)[number];
export type VerticalAlign = (typeof VERTICAL_ALIGNS)[number];
export type HorizontalAlign = (typeof HORIZONTAL_ALIGNS)[number];

/** justify-content of a flex column cell. Baseline cells start at the top and are padded down. */
export const JUSTIFY: Record<VerticalAlign, string> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
  baseline: "flex-start",
};

/**
 * align-items of a flex column cell. `left` stretches: a chart measures the
 * width of its wrapper, and flex-start would shrink that wrapper.
 */
export const ALIGN: Record<HorizontalAlign, string> = {
  left: "stretch",
  center: "center",
  right: "flex-end",
  baseline: "stretch",
};

/** Parses `cell-captions`: a JSON object from slot name to caption text. `undefined` when invalid. */
export function parseCaptions(json: string | undefined): Record<string, string> | undefined {
  if (json === undefined || json.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  const captions: Record<string, string> = {};
  for (const [slot, text] of Object.entries(parsed)) {
    if (typeof text !== "string") return undefined;
    if (text !== "") captions[slot] = text;
  }
  return captions;
}

/** What the slotted child of a cell says about its cell. */
export interface CellAttributes {
  rowSpan: number;
  columnSpan: number;
  background?: string;
}

/** The value of `row-span` or `column-span`: a whole number from 1. `undefined` when invalid. */
export function parseSpan(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return 1;
  const span = Number(value);
  return Number.isInteger(span) && span >= 1 ? span : undefined;
}

/** One data cell: its first row and column, and how many of them it covers. */
export interface PlacedCell {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
}

/**
 * The data cells of a grid, row by row. A cell with a span also takes the
 * positions right of it and below it, and those get no cell of their own. A
 * span ends at the edge of the grid, and before a position that is taken.
 */
export function placeCells(
  rowCount: number,
  columnCount: number,
  spanOf: (row: number, column: number) => { rowSpan: number; columnSpan: number } | undefined,
): { cells: PlacedCell[]; covered: { row: number; column: number; by: PlacedCell }[] } {
  const owner: (PlacedCell | undefined)[][] = Array.from({ length: rowCount }, () => Array(columnCount));
  const cells: PlacedCell[] = [];
  const covered: { row: number; column: number; by: PlacedCell }[] = [];
  for (let row = 0; row < rowCount; row++) {
    for (let column = 0; column < columnCount; column++) {
      const by = owner[row][column];
      if (by) {
        covered.push({ row, column, by });
        continue;
      }
      const span = spanOf(row, column);
      const rowSpan = Math.min(span?.rowSpan ?? 1, rowCount - row);
      let columnSpan = 1;
      const wanted = Math.min(span?.columnSpan ?? 1, columnCount - column);
      // a taken position in this row is taken by a cell from above, so the rows below need no check
      while (columnSpan < wanted && !owner[row][column + columnSpan]) columnSpan++;
      const cell = { row, column, rowSpan, columnSpan };
      for (let r = row; r < row + rowSpan; r++) {
        for (let c = column; c < column + columnSpan; c++) owner[r][c] = cell;
      }
      cells.push(cell);
    }
  }
  return { cells, covered };
}

/** One cell as the baseline pass sees it, in the grid's layout px. */
export interface BaselineCell {
  slot: string;
  row: number;
  column: number;
  /** More than 1: the cell is in no single row (or column), so that axis is not aligned. */
  rowSpan?: number;
  columnSpan?: number;
  /** Baseline of the component in the cell, with the current offsets applied. */
  y?: number;
  x?: number;
  /** Offsets applied now. */
  top: number;
  left: number;
}

/** Where a cell's content goes: padded down/right, or at the bottom when it has no baseline. */
export interface CellOffset {
  top?: number;
  left?: number;
  /** Space kept free on the right, so every component of a column has the same width and stays in its cell. */
  right?: number;
  bottom?: boolean;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Offsets that put every baseline of a row on the lowest one, and every
 * baseline of a column on the rightmost one. A cell without a baseline on an
 * axis goes to the bottom (vertical) or stays left (horizontal). A cell over
 * several rows is left out of the rows and stays at the top; a cell over
 * several columns is left out of the columns and stays left.
 */
export function baselineOffsets(
  cells: BaselineCell[],
  vertical: boolean,
  horizontal: boolean,
): Record<string, CellOffset> {
  const offsets: Record<string, CellOffset> = {};
  for (const cell of cells) offsets[cell.slot] = {};

  const line = (
    key: "row" | "column",
    span: "rowSpan" | "columnSpan",
    value: (cell: BaselineCell) => number | undefined,
    applied: (cell: BaselineCell) => number,
    set: (offset: CellOffset, pad: number | undefined, largest: number) => void,
  ) => {
    const groups = new Map<number, BaselineCell[]>();
    for (const cell of cells) {
      if ((cell[span] ?? 1) > 1) continue;
      groups.set(cell[key], [...(groups.get(cell[key]) ?? []), cell]);
    }
    for (const group of groups.values()) {
      // where each baseline would be without an offset
      const natural = group.map((cell) => {
        const v = value(cell);
        return v === undefined ? undefined : v - applied(cell);
      });
      const known = natural.filter((v): v is number => v !== undefined);
      const target = known.length > 0 ? Math.max(...known) : 0;
      const pads = natural.map((v) => (v === undefined ? undefined : round2(target - v)));
      const largest = Math.max(0, ...pads.filter((pad): pad is number => pad !== undefined));
      group.forEach((cell, index) => set(offsets[cell.slot], pads[index], largest));
    }
  };

  if (vertical) {
    line(
      "row",
      "rowSpan",
      (cell) => cell.y,
      (cell) => cell.top,
      (offset, pad) => {
        if (pad === undefined) offset.bottom = true;
        else offset.top = pad;
      },
    );
  }
  if (horizontal) {
    line(
      "column",
      "columnSpan",
      (cell) => cell.x,
      (cell) => cell.left,
      (offset, pad, largest) => {
        if (pad !== undefined) offset.left = pad;
        const right = round2(largest - (pad ?? 0));
        if (right > 0) offset.right = right;
      },
    );
  }
  return offsets;
}

/** Two offset maps place every cell within half a px of each other. */
export function sameOffsets(a: Record<string, CellOffset>, b: Record<string, CellOffset>): boolean {
  const slots = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const slot of slots) {
    const x = a[slot] ?? {};
    const y = b[slot] ?? {};
    if (Boolean(x.bottom) !== Boolean(y.bottom)) return false;
    if (Math.abs((x.top ?? 0) - (y.top ?? 0)) >= 0.5) return false;
    if (Math.abs((x.left ?? 0) - (y.left ?? 0)) >= 0.5) return false;
    if (Math.abs((x.right ?? 0) - (y.right ?? 0)) >= 0.5) return false;
  }
  return true;
}
