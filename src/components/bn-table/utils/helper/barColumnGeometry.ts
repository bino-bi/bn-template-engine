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
/** Bar or pin extent per side a column too narrow for its labels still keeps, in em. */
const MIN_EXTENT_EM = 1;
/** Share of the per-side bar extent reserved for the overdrive stub. */
const OVERDRIVE_FRACTION = 0.15;
/** Width of the axis of a variance bar or pin, in em: near the 0.3em scenario marker in the header. */
export const VARIANCE_AXIS_EM = 0.25;
/** Side of the square pin head, in px before scaleFactor. */
export const PIN_HEAD_SIZE = 10;

/**
 * Advance widths in em, the larger of Noto Sans and Arial so a fallback font still fits.
 * Digits and signs share one width in both; any other glyph counts as a wide letter.
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

/** Estimated rendered width of a value label in px. */
export function estimateLabelWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text) {
    em += GLYPH_EM[char] ?? (/[0-9+]/.test(char) ? DIGIT_EM : OTHER_EM);
  }
  return em * fontSize;
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

/**
 * Reserves per side only what its widest label needs (`outerReserve` covers what sticks
 * out beyond the bar or pin end, e.g. the half head) and gives the rest to the bars or pins.
 * A column too narrow for its labels shrinks the reserves rather than the total, so wN
 * stays wN, and the labels overflow.
 */
function splitSides(
  totalWidth: number,
  emPx: number,
  labels: SideLabels,
  outerReserve: number,
  labelGap: number,
): SideSplit {
  const hasNeg = labels.neg !== undefined;
  const hasPos = labels.pos !== undefined || !hasNeg;
  const sides = (hasNeg ? 1 : 0) + (hasPos ? 1 : 0);
  const need = (width: number | undefined) => outerReserve + labelGap + (width ?? 0);
  const negNeed = hasNeg ? need(labels.neg) : 0;
  const posNeed = hasPos ? need(labels.pos) : 0;
  const available = Math.max(0, totalWidth - sides * Math.min(MIN_EXTENT_EM * emPx, totalWidth / (2 * sides)));
  const shrink = Math.min(1, available / (negNeed + posNeed));
  const negReserve = negNeed * shrink;
  const extent = (totalWidth - negReserve - posNeed * shrink) / sides;

  return { extent, axisX: hasNeg ? negReserve + extent : 0 };
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
  const { extent: maxBarWidth, axisX } = splitSides(totalWidth, emPx, labels, (VARIANCE_AXIS_EM * emPx) / 2, labelGap);
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
  /** Max pin extent on one side of the axis, to the centre of the head or the base of the arrow tip. */
  maxPinLength: number;
  axisX: number;
  /** Gap between the pin head and its value label. */
  labelGap: number;
}

export function relativePinGeometry(
  widthEm: number,
  emPx: number,
  labels: SideLabels,
  headSize: number,
): RelativePinGeometry {
  const totalWidth = contentWidth(widthEm, emPx);
  const labelGap = LABEL_GAP_EM * emPx;
  const { extent, axisX } = splitSides(totalWidth, emPx, labels, headSize / 2, labelGap);

  return { totalWidth, maxPinLength: extent, axisX, labelGap };
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
