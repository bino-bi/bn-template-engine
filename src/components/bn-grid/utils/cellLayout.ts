/**
 * Cell size and alignment for bn-grid: the accepted values, their CSS, and
 * the offsets that line up the baselines of the components in a row or column.
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

/** One cell as the baseline pass sees it, in the grid's layout px. */
export interface BaselineCell {
  slot: string;
  row: number;
  column: number;
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
  bottom?: boolean;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Offsets that put every baseline of a row on the lowest one, and every
 * baseline of a column on the rightmost one. A cell without a baseline on an
 * axis goes to the bottom (vertical) or stays left (horizontal).
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
    value: (cell: BaselineCell) => number | undefined,
    applied: (cell: BaselineCell) => number,
    set: (offset: CellOffset, pad: number | undefined) => void,
  ) => {
    const groups = new Map<number, BaselineCell[]>();
    for (const cell of cells) groups.set(cell[key], [...(groups.get(cell[key]) ?? []), cell]);
    for (const group of groups.values()) {
      // where each baseline would be without an offset
      const natural = group.map((cell) => {
        const v = value(cell);
        return v === undefined ? undefined : v - applied(cell);
      });
      const known = natural.filter((v): v is number => v !== undefined);
      const target = known.length > 0 ? Math.max(...known) : 0;
      group.forEach((cell, index) => {
        const v = natural[index];
        set(offsets[cell.slot], v === undefined ? undefined : round2(target - v));
      });
    }
  };

  if (vertical) {
    line(
      "row",
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
      (cell) => cell.x,
      (cell) => cell.left,
      (offset, pad) => {
        if (pad !== undefined) offset.left = pad;
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
  }
  return true;
}
