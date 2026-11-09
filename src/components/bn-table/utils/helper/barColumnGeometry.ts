/**
 * Column geometry for the inline bar / pin / waterfall charts of bn-table.
 *
 * `bar-column-width="wN"` and `category-width="wN"` both mean "N em of the table font",
 * so both columns render at the same width for the same N. The em used here is the TRUE
 * table em (`--bn-font-size`, i.e. `global.fontSizePx × scaleFactor`) - deliberately NOT
 * `CellBarChartStyles.fontSize`, which is 0.85 of it and doubles as the unitScaling /
 * percentageScaling basis.
 *
 * Every quantity is returned in px so the SVG renderers stay in one coordinate space.
 */

/**
 * SVG label font size relative to the table em. Also the multiplier in the
 * unitScaling / percentageScaling math, so changing it rescales every user-set value.
 */
export const BAR_LABEL_FONT_RATIO = 0.85;

/**
 * Horizontal padding of a bar cell, in table em:
 * `td:has(.cell-bar-chart) { padding: 0 0.25em }` (bn-table-renderer.scss:320).
 * With `box-sizing: border-box` the SVG has to be that much narrower than the requested
 * column width, so the cell's border box lands on exactly N em - the same box
 * `.category-wN` (bn-table-renderer.scss:50-83) produces.
 */
const BAR_CELL_PADDING_EM = 0.5;

/** Value-label gutter beside a waterfall bar, in em (was a hardcoded 38 px at the 13.3333 px em). */
const BAR_LABEL_EM = 2.85;
/** Zigzag break gap of an overdrive bar, in em (was 4 px). */
const BREAK_GAP_EM = 0.3;
/** Gap between a bar/pin end and its value label, in em (was 4 px). */
const LABEL_GAP_EM = 0.3;
/** Pin extent per side kept before a pin column drops label digits, in em. */
const MIN_EXTENT_EM = 1;
/** Share of the per-side bar extent reserved for the overdrive stub. */
const OVERDRIVE_FRACTION = 0.15;
/** Width of the axis of a variance bar or pin, in em: near the 0.3em scenario marker in the header. */
export const VARIANCE_AXIS_EM = 0.25;
/** Side of the square pin head, in px before scaleFactor. */
export const PIN_HEAD_SIZE = 10;

/**
 * Advance widths in em, the larger of Noto Sans and Arial. The engine ships no font, so a
 * wider fallback (DejaVu Sans, Verdana) is possible: LABEL_WIDTH_MARGIN and the cell
 * padding cover it. Any glyph not listed counts as a wide letter.
 */
const GLYPH_EM: Record<string, number> = {
  ".": 0.28,
  ",": 0.28,
  "-": 0.34,
  "%": 0.89,
  " ": 0.28,
  "\u00a0": 0.28,
  "\u202f": 0.28,
  M: 0.9,
};
const DIGIT_EM = 0.59;
const OTHER_EM = 0.72;
/** Labels fill the cell to the edge, so the estimate keeps room for a wider fallback font. */
const LABEL_WIDTH_MARGIN = 1.1;

/** Estimated rendered width of a value label in px, with a margin for wider fonts. */
export function estimateLabelWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) {
    em += GLYPH_EM[char] ?? (/[0-9+]/.test(char) ? DIGIT_EM : OTHER_EM);
  }
  return em * fontSize * LABEL_WIDTH_MARGIN;
}

/** Safety pad on a measured label, in label font size: covers subpixel rounding only. */
const MEASURE_PAD = 0.15;

let measureContext: CanvasRenderingContext2D | null | undefined;

/** One shared 2D context; null where the document has no canvas (spec tests, mock-doc). */
function labelMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext === undefined) {
    try {
      measureContext =
        typeof document === "undefined" ? null : (document.createElement("canvas").getContext?.("2d") ?? null);
    } catch {
      measureContext = null;
    }
  }
  return measureContext;
}

/**
 * Rendered width of a value label in px, measured with the font the SVG text uses. Falls
 * back to estimateLabelWidth where no canvas can measure.
 */
export function labelWidth(text: string, fontSize: number, fontFamily: string, italic: boolean): number {
  const ctx = labelMeasureContext();
  if (ctx) {
    ctx.font = `${italic ? "italic " : ""}${fontSize}px ${fontFamily}`;
    const width = ctx.measureText(text).width;
    if (Number.isFinite(width) && (width > 0 || text === "")) return width + MEASURE_PAD * fontSize;
  }
  return estimateLabelWidth(text, fontSize);
}

/** Widest value label in px per side of the axis; a side without drawn values is undefined. */
export interface SideLabels {
  neg?: number;
  pos?: number;
}

/** The SVG fills the cell's content box: the requested column width minus the cell padding. */
function contentWidth(widthEm: number, emPx: number): number {
  return Math.max(0, (widthEm - BAR_CELL_PADDING_EM) * emPx);
}

interface SideSplit {
  /** Extent of the bars or pins on one side of the axis; equal on both sides. */
  extent: number;
  axisX: number;
}

interface SideNeeds {
  sides: number;
  /** What the label side of the axis needs beyond the bar or pin end; 0 for a side without values. */
  neg: number;
  pos: number;
}

/** `outerReserve` covers what sticks out beyond the bar or pin end, e.g. the half head. */
function sideNeeds(labels: SideLabels, outerReserve: number, labelGap: number): SideNeeds {
  const hasNeg = labels.neg !== undefined;
  const hasPos = labels.pos !== undefined || !hasNeg;
  const need = (has: boolean, width: number | undefined) => (has ? outerReserve + labelGap + (width ?? 0) : 0);
  return { sides: (hasNeg ? 1 : 0) + (hasPos ? 1 : 0), neg: need(hasNeg, labels.neg), pos: need(hasPos, labels.pos) };
}

/** Bar or pin extent per side that a column keeps as long as its labels allow. */
function minExtent(totalWidth: number, emPx: number, sides: number): number {
  return Math.min(MIN_EXTENT_EM * emPx, totalWidth / (2 * sides));
}

/**
 * Reserves per side only what its widest label needs and gives the rest to the bars or
 * pins. A column too narrow for that shortens the bars or pins first, down to zero, so a
 * label keeps its sign. Only a column narrower than its labels alone shrinks the
 * reserves, and then the labels overflow. wN stays wN in every case.
 */
function splitSides(totalWidth: number, labels: SideLabels, outerReserve: number, labelGap: number): SideSplit {
  const { sides, neg, pos } = sideNeeds(labels, outerReserve, labelGap);
  const shrink = neg + pos > 0 ? Math.min(1, totalWidth / (neg + pos)) : 1;
  const extent = Math.max(0, (totalWidth - (neg + pos) * shrink) / sides);

  return { extent, axisX: labels.neg !== undefined ? neg * shrink + extent : 0 };
}

/** True when the labels fit beside pins of at least the minimum extent; else the caller drops digits. */
export function pinLabelsFit(widthEm: number, emPx: number, labels: SideLabels, headSize: number): boolean {
  const totalWidth = contentWidth(widthEm, emPx);
  const { sides, neg, pos } = sideNeeds(labels, headSize / 2, LABEL_GAP_EM * emPx);
  return neg + pos + sides * minExtent(totalWidth, emPx, sides) <= totalWidth + 1e-6;
}

export interface AbsoluteBarGeometry {
  /** SVG width - the cell's content box. */
  totalWidth: number;
  /** Max bar extent on one side of the axis. */
  maxBarWidth: number;
  axisX: number;
  breakGap: number;
  overdriveZoneWidth: number;
  /** Bar length above which the overdrive break kicks in. */
  cutWidth: number;
  /** Gap between the bar end and its value label. */
  labelGap: number;
}

export function absoluteBarGeometry(widthEm: number, emPx: number, labels: SideLabels): AbsoluteBarGeometry {
  const totalWidth = contentWidth(widthEm, emPx);
  const labelGap = LABEL_GAP_EM * emPx;
  // a variance bar starts at the outer edge of the thick axis
  const { extent: maxBarWidth, axisX } = splitSides(totalWidth, labels, (VARIANCE_AXIS_EM * emPx) / 2, labelGap);
  const breakGap = Math.min(BREAK_GAP_EM * emPx, maxBarWidth * 0.2);
  const overdriveZoneWidth = maxBarWidth * OVERDRIVE_FRACTION;

  return {
    totalWidth,
    maxBarWidth,
    axisX,
    breakGap,
    overdriveZoneWidth,
    cutWidth: Math.max(0, maxBarWidth - breakGap - overdriveZoneWidth),
    labelGap,
  };
}

export interface RelativePinGeometry {
  totalWidth: number;
  /** Max pin extent of the longer side, to the centre of the head or the base of the arrow tip. */
  maxPinLength: number;
  /** Max pin extent per side; a longer pin is cut and ends in an arrow. */
  negPinLength: number;
  posPinLength: number;
  axisX: number;
  /** Gap between the pin head and its value label. */
  labelGap: number;
}

/**
 * `reach` is the length in px the longest pin of each side wants at the column's scale.
 * With it, the pin room is split by what each side needs, so a side with shorter pins
 * gives its room to the other; room left after both is shared equally. Without it, both
 * sides get the same extent.
 */
export function relativePinGeometry(
  widthEm: number,
  emPx: number,
  labels: SideLabels,
  headSize: number,
  reach?: SideLabels,
): RelativePinGeometry {
  const totalWidth = contentWidth(widthEm, emPx);
  const labelGap = LABEL_GAP_EM * emPx;
  const { extent, axisX } = splitSides(totalWidth, labels, headSize / 2, labelGap);
  const hasNeg = labels.neg !== undefined;
  const hasPos = labels.pos !== undefined || !hasNeg;
  let neg = hasNeg ? extent : 0;
  let pos = hasPos ? extent : 0;
  if (reach && hasNeg && hasPos) {
    const room = 2 * extent;
    const wantNeg = Math.max(0, reach.neg ?? 0);
    const wantPos = Math.max(0, reach.pos ?? 0);
    if (wantNeg + wantPos <= room + 1e-6) {
      neg = wantNeg + (room - wantNeg - wantPos) / 2;
      pos = room - neg;
    } else if (wantNeg < extent) {
      neg = wantNeg;
      pos = room - neg;
    } else if (wantPos < extent) {
      pos = wantPos;
      neg = room - pos;
    }
  }

  return {
    totalWidth,
    maxPinLength: Math.max(neg, pos),
    negPinLength: neg,
    posPinLength: pos,
    axisX: hasNeg ? axisX - extent + neg : 0,
    labelGap,
  };
}

export interface WaterfallGeometry {
  totalWidth: number;
  /** One gutter on each side; a waterfall always spans its full range. */
  labelAreaWidth: number;
  barAreaWidth: number;
  labelGap: number;
}

export function waterfallGeometry(widthEm: number, emPx: number): WaterfallGeometry {
  const totalWidth = contentWidth(widthEm, emPx);
  const labelAreaWidth = Math.min(BAR_LABEL_EM * emPx, totalWidth / 4);

  return {
    totalWidth,
    labelAreaWidth,
    barAreaWidth: totalWidth - labelAreaWidth * 2,
    labelGap: LABEL_GAP_EM * emPx,
  };
}
