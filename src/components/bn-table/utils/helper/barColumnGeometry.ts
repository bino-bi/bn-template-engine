/**
 * Column geometry for the inline bar / pin / waterfall charts of bn-table.
 *
 * `bar-column-width="wN"` and `category-width="wN"` both mean "N em of the table font",
 * so both columns render at the same width for the same N. The em used here is the TRUE
 * table em (`--bn-font-size`, i.e. `global.fontSizePx × scaleFactor`) — deliberately NOT
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
 * `td:has(.cell-bar-chart) { padding: 0 0.25em }` (ibcs-table.scss:320).
 * With `box-sizing: border-box` the SVG has to be that much narrower than the requested
 * column width, so the cell's border box lands on exactly N em — the same box
 * `.category-wN` (ibcs-table.scss:50-83) produces.
 */
const BAR_CELL_PADDING_EM = 0.5;

/** Value-label gutter beside a bar, in em (was a hardcoded 38 px at the 13.3333 px em). */
const BAR_LABEL_EM = 2.85;
/** Value-label gutter beside a pin, in em (was 45 px). */
const PIN_LABEL_EM = 3.375;
/** Gap between the axis and the start of a pin's reserved side, in em (was 5 px). */
const PIN_PADDING_EM = 0.375;
/** Zigzag break gap of an overdrive bar, in em (was 4 px). */
const BREAK_GAP_EM = 0.3;
/** Gap between a bar/pin end and its value label, in em (was 4 px). */
const LABEL_GAP_EM = 0.3;
/** Share of the per-side bar extent reserved for the overdrive stub. */
const OVERDRIVE_FRACTION = 0.15;

/** The SVG fills the cell's content box: the requested column width minus the cell padding. */
function contentWidth(widthEm: number, emPx: number): number {
  return Math.max(0, (widthEm - BAR_CELL_PADDING_EM) * emPx);
}

/** Sides the axis serves. Clamped to 1 so a hypothetical all-zero column never divides by 0. */
function sideCount(hasNeg: boolean, hasPos: boolean): number {
  return Math.max(1, (hasNeg ? 1 : 0) + (hasPos ? 1 : 0));
}

export interface AbsoluteBarGeometry {
  /** SVG width — the cell's content box. */
  totalWidth: number;
  /** Width of one value-label gutter; one is drawn per side in use. */
  labelAreaWidth: number;
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

export function absoluteBarGeometry(
  widthEm: number,
  emPx: number,
  hasNeg: boolean,
  hasPos: boolean,
): AbsoluteBarGeometry {
  const totalWidth = contentWidth(widthEm, emPx);
  const sides = sideCount(hasNeg, hasPos);
  // Narrow columns shrink the gutters rather than the total, so wN stays wN.
  const labelAreaWidth = Math.min(BAR_LABEL_EM * emPx, totalWidth / (2 * sides));
  const maxBarWidth = (totalWidth - labelAreaWidth * sides) / sides;
  const breakGap = Math.min(BREAK_GAP_EM * emPx, maxBarWidth * 0.2);
  const overdriveZoneWidth = maxBarWidth * OVERDRIVE_FRACTION;

  return {
    totalWidth,
    labelAreaWidth,
    maxBarWidth,
    axisX: hasNeg ? labelAreaWidth + maxBarWidth : 0,
    breakGap,
    overdriveZoneWidth,
    cutWidth: Math.max(0, maxBarWidth - breakGap - overdriveZoneWidth),
    labelGap: LABEL_GAP_EM * emPx,
  };
}

export interface RelativePinGeometry {
  totalWidth: number;
  /** Single gutter, always on the right. */
  labelAreaWidth: number;
  /** Max pin extent on one side of the axis. */
  maxPinLength: number;
  pinPadding: number;
  axisX: number;
  labelX: number;
}

export function relativePinGeometry(
  widthEm: number,
  emPx: number,
  hasNeg: boolean,
  hasPos: boolean,
): RelativePinGeometry {
  const totalWidth = contentWidth(widthEm, emPx);
  const sides = sideCount(hasNeg, hasPos);
  const labelAreaWidth = Math.min(PIN_LABEL_EM * emPx, totalWidth / 2);
  const pinAreaWidth = totalWidth - labelAreaWidth;
  const sideWidth = pinAreaWidth / sides;
  const pinPadding = Math.min(PIN_PADDING_EM * emPx, sideWidth * 0.2);

  return {
    totalWidth,
    labelAreaWidth,
    maxPinLength: Math.max(0, sideWidth - pinPadding),
    pinPadding,
    axisX: hasNeg ? sideWidth : 0,
    labelX: pinAreaWidth + LABEL_GAP_EM * emPx,
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
