import { h, FunctionalComponent } from "@stencil/core";
import { ColumnStats } from "./Cell";
import { Formatter } from "../../../../utils";
import { FillPattern } from "../../../../utils/model/styles/SVGStyle";
import { VarianceScenario } from "../../../../utils/model/VarianceScenario";
import {
  absoluteBarGeometry,
  BAR_LABEL_FONT_RATIO,
  barBox,
  labelWidth,
  PIN_HEAD_SIZE,
  relativePinGeometry,
  SideLabels,
  VARIANCE_AXIS_EM,
} from "../helper/barColumnGeometry";

/** Matches SYSTEM_STYLE_DEFAULTS.global.fontSizePx; only used when `styles` is omitted. */
const DEFAULT_EM_PX = 13.3333;

export interface VarianceStyle {
  stroke: string;
  fill: string;
  fillpattern?: FillPattern;
}

export interface ScenarioStyles {
  ac: VarianceStyle;
  pp: VarianceStyle;
  fc: VarianceStyle;
  pl: VarianceStyle;
}

export interface CellBarChartStyles {
  // Variance styles (for d_ and dr_ columns)
  positive: VarianceStyle;
  negative: VarianceStyle;
  neutral: VarianceStyle;
  // Scenario styles (for ac, pp, fc, pl columns)
  scenarios: ScenarioStyles;
  fontColor: string;
  /**
   * SVG label font size in px - BAR_LABEL_FONT_RATIO × emPx. It is also the multiplier in
   * the unitScaling / percentageScaling math below, so changing it rescales every user-set
   * scaling value. Column geometry deliberately uses emPx instead.
   */
  fontSize: number;
  /** The table's true em in px (`global.fontSizePx` × scaleFactor) - column geometry only. */
  emPx: number;
  fontFamily: string;
  unitScaling: number; // Em per data unit for absolute variance bars (bar px = |value| × unitScaling × fontSize)
  percentageScaling: number; // Em per percentage point for relative variance pins
  scaleFactor: number; // Proportional scaling factor for all pixel constants
}

export interface CellBarChartProps {
  value: number;
  scenario: string;
  columnStats: ColumnStats;
  height: number;
  isRelative: boolean;
  isPositiveGood: boolean;
  formattedValue?: string;
  measureScale?: number;
  locale?: string;
  percentDigits?: number;
  /** Fraction digits of an absolute label, as in the number cells; without it the label takes an SI suffix. */
  decimalDigits?: number;
  /** False drops the % of a relative label, for a column too narrow for it. */
  percentSign?: boolean;
  /** Total column width in table em - see barColumnGeometry.ts. */
  columnWidthEm?: number;
  /** Widest label per side over the drawn cells of the column; without it only this cell's label counts. */
  labelWidths?: SideLabels;
  /** Largest absolute drawn value per side over the column; without it the column statistics count. */
  sideMax?: SideLabels;
  /** The row prints bold, so the label is measured bold. */
  bold?: boolean;
  styles?: CellBarChartStyles;
}

// Default fallback colors (should come from componentStyle)
export const DEFAULT_STYLES: CellBarChartStyles = {
  positive: { stroke: "#008f96", fill: "#008f96", fillpattern: "solid" },
  negative: { stroke: "#ff0000", fill: "#ff0000", fillpattern: "solid" },
  neutral: { stroke: "#808080", fill: "#808080", fillpattern: "outlined" },
  scenarios: {
    ac: { stroke: "#404040", fill: "#404040", fillpattern: "solid" },
    pp: { stroke: "#A6A6A6", fill: "#A6A6A6", fillpattern: "solid" },
    fc: { stroke: "#404040", fill: "#ffffff", fillpattern: "hatched" },
    pl: { stroke: "#404040", fill: "#ffffff", fillpattern: "outlined" },
  },
  fontColor: "#000000",
  fontSize: DEFAULT_EM_PX * BAR_LABEL_FONT_RATIO,
  emPx: DEFAULT_EM_PX,
  fontFamily: "'Noto Sans', sans-serif",
  unitScaling: 0.01, // Default: 100 units per em of bar
  percentageScaling: 0.5, // Default: 2 percentage points per em of pin
  scaleFactor: 1,
};

export const AXIS_COLOR = "#666666";

/** Width of the pin line, in px before scaleFactor. */
const PIN_LINE_WIDTH = 3;
/** Arrow head of a cut pin, in sides of the square pin head: IBCS draws it a bit larger. */
const PIN_ARROW_RATIO = 1.2;
/** Padding of the light band under the label on a cut pin, in label font sizes. */
const PIN_BAND_PAD = 0.2;

/**
 * Creates a unique pattern ID for the SVG defs
 */
function getPatternId(prefix: string, color: string): string {
  return `pattern-${prefix}-${color.replace("#", "")}`;
}

/** The hatching of a pin head: light lines on the dark colour of the scenario, as IBCS draws it. */
function getHeadPatternId(slot: string, color: string): string {
  return getPatternId(`head-${slot}`, color);
}

/**
 * Renders SVG pattern definitions for hatched fills
 */
export const PatternDefs: FunctionalComponent<{ styles: CellBarChartStyles }> = ({ styles }) => {
  const s = styles.scaleFactor;
  const size = 3 * s;
  const patterns: { id: string; line: string; background: string; lineWidth: number }[] = [
    {
      id: getPatternId("pos", styles.positive.stroke),
      line: styles.positive.stroke,
      background: "#ffffff",
      lineWidth: 1,
    },
    {
      id: getPatternId("neg", styles.negative.stroke),
      line: styles.negative.stroke,
      background: "#ffffff",
      lineWidth: 1,
    },
    {
      id: getPatternId("neu", styles.neutral.stroke),
      line: styles.neutral.stroke,
      background: "#ffffff",
      lineWidth: 1,
    },
    ...(["ac", "pp", "fc", "pl"] as const).flatMap((type) => [
      {
        id: getPatternId(type, styles.scenarios[type].stroke),
        line: styles.scenarios[type].stroke,
        background: "#ffffff",
        lineWidth: 1,
      },
      {
        id: getHeadPatternId(type, styles.scenarios[type].stroke),
        line: "#ffffff",
        background: styles.scenarios[type].stroke,
        lineWidth: 0.6,
      },
    ]),
  ];
  // the diagonal of the tile and its two ends in the next tiles, so the lines join without notches
  const diagonals = [
    [0, size, size, 0],
    [-s, s, s, -s],
    [size - s, size + s, size + s, size - s],
  ];

  return (
    <defs>
      {patterns.map((p) => (
        <pattern id={p.id} patternUnits="userSpaceOnUse" width={size} height={size}>
          <rect width={size} height={size} fill={p.background} />
          {diagonals.map(([x1, y1, x2, y2]) => (
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.line} stroke-width={p.lineWidth * s} />
          ))}
        </pattern>
      ))}
    </defs>
  );
};

/** Longest relative label that keeps all percent digits; a longer one drops digits so its gutter does not eat the pins. */
const PIN_LABEL_CHARS = 7;

/**
 * Formats a bar or pin label. An absolute value with `decimalDigits` prints like a number
 * cell, without them it takes an SI suffix.
 */
export function formatValue(
  value: number,
  isRelative: boolean,
  measureScale: number = 1,
  locale?: string,
  percentDigits: number = 0,
  percentSign: boolean = true,
  decimalDigits?: number,
): string {
  // IBCS prints a value that rounds to zero without a sign
  const signed = (text: string, zero: string) => (value > 0 && text !== zero ? "+" : "") + text;

  if (isRelative) {
    // Relative variance is stored as decimal (e.g., -2.0 = -200%)
    const number = (v: number, digits: number) =>
      percentSign
        ? Formatter.number(v, "percent", digits, digits, 1, locale)
        : Formatter.number(v * 100, "decimal", digits, digits, 1, locale);
    const format = (digits: number) => signed(number(value, digits), number(0, digits));
    // Intl throws on a digit count outside 0 to 20
    let digits = Math.min(20, Math.max(0, Math.trunc(percentDigits) || 0));

    while (digits > 0 && format(digits).length > PIN_LABEL_CHARS) {
      digits--;
    }

    return format(digits);
  }

  // Absolute variance - apply measure scale and use SI prefixes
  const scaledValue = value / measureScale;

  if (decimalDigits !== undefined) {
    const number = (v: number) => Formatter.number(v, "decimal", decimalDigits, decimalDigits, 1, locale);
    return signed(number(scaledValue), number(0));
  }

  const absValue = Math.abs(scaledValue);

  let unit = 1;
  let suffix = "";
  // 999.5 of a unit rounds to 1000, so it takes the next unit (+1M, not +1.000K)
  if (absValue >= 999500000) {
    unit = 1000000000;
    suffix = "B";
  } else if (absValue >= 999500) {
    unit = 1000000;
    suffix = "M";
  } else if (absValue >= 999.5) {
    unit = 1000;
    suffix = "K";
  }

  const digits = absValue >= unit * 10 ? 0 : 1;

  return (
    signed(
      Formatter.number(scaledValue / unit, "decimal", digits, 0, 1, locale),
      Formatter.number(0, "decimal", digits, 0, 1, locale),
    ) + suffix
  );
}

/**
 * Checks if the column is a scenario column (ac, pp, fc, pl) vs variance (d_, dr_).
 */
function isScenarioColumn(scenario: string): boolean {
  const scenarioPrefix = scenario.slice(0, 2).toLowerCase();
  return ["ac", "pp", "fc", "pl"].includes(scenarioPrefix);
}

/**
 * Gets the scenario type from the column name (ac, pp, fc, pl).
 */
export function getScenarioType(scenario: string): "ac" | "pp" | "fc" | "pl" {
  const scenarioPrefix = scenario.slice(0, 2).toLowerCase();
  if (scenarioPrefix === "pp") return "pp";
  if (scenarioPrefix === "fc") return "fc";
  if (scenarioPrefix === "pl") return "pl";
  return "ac"; // default
}

/**
 * Gets the style for a scenario column (ac, pp, fc, pl).
 */
function getScenarioStyle(scenario: string, styles: CellBarChartStyles): VarianceStyle {
  const type = getScenarioType(scenario);
  return styles.scenarios[type];
}

type ScenarioSlot = keyof ScenarioStyles;

/**
 * IBCS look of a variance: the bar pattern and the pin head come from the minuend,
 * the axis from the reference (subtrahend). Null for scenario columns and unparsable names.
 */
interface VarianceLook {
  minuend: VarianceStyle;
  minuendSlot: ScenarioSlot;
  reference: VarianceStyle;
  referenceSlot: ScenarioSlot;
}

export function getVarianceLook(scenario: string, styles: CellBarChartStyles): VarianceLook | null {
  if (isScenarioColumn(scenario)) return null;
  const variance = new VarianceScenario(scenario);
  if (!variance.isValid) return null;
  const minuendSlot = getScenarioType(variance.base);
  const referenceSlot = getScenarioType(variance.delta);
  return {
    minuend: styles.scenarios[minuendSlot],
    minuendSlot,
    reference: styles.scenarios[referenceSlot],
    referenceSlot,
  };
}

/**
 * Axis of a variance bar or pin in the look of the reference scenario: solid (AC, PY),
 * a double line (PL, outlined) or dashed (FC, hatched). Lines only, so the bar stays the
 * one direct-child rect of the svg.
 */
export const VarianceAxis: FunctionalComponent<{
  x: number;
  height: number;
  look: VarianceLook;
  styles: CellBarChartStyles;
}> = ({ x, height, look, styles }) => {
  const s = styles.scaleFactor;
  const width = VARIANCE_AXIS_EM * styles.emPx;
  const { reference, referenceSlot } = look;

  let lines: unknown;
  if (reference.fillpattern === "outlined") {
    // two lines with a gap of their width, together as wide as a solid axis
    const lineWidth = width / 3;
    const offset = (width - lineWidth) / 2;
    lines = [x - offset, x + offset].map((lineX) => (
      <line x1={lineX} y1={0} x2={lineX} y2={height} stroke={reference.stroke} stroke-width={lineWidth} />
    ));
  } else if (reference.fillpattern === "hatched") {
    lines = (
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={reference.stroke}
        stroke-width={width}
        stroke-dasharray={`${2 * s}`}
      />
    );
  } else {
    lines = <line x1={x} y1={0} x2={x} y2={height} stroke={reference.fill} stroke-width={width} />;
  }

  return <g class={`variance-axis axis-${referenceSlot}`}>{lines}</g>;
};

/** A zero value is drawn on the positive side, unless the column only has negative values. */
export function zeroOnPositiveSide(labels: SideLabels): boolean {
  return labels.pos !== undefined || labels.neg === undefined;
}

/** Side coverage from the column statistics, with only this cell's label as the width. */
function ownLabelWidths(columnStats: ColumnStats, width: number): SideLabels {
  return {
    neg: columnStats.min < 0 ? width : undefined,
    pos: columnStats.max > 0 ? width : undefined,
  };
}

/**
 * Gets the variance style based on value and sentiment direction.
 * pos suffix = positive values are good (green), negative are bad (red)
 * neg suffix = negative values are good (green), positive are bad (red)
 */
function getVarianceStyle(value: number, isPositiveGood: boolean, styles: CellBarChartStyles): VarianceStyle {
  const isPositive = value >= 0;

  if (isPositiveGood) {
    return isPositive ? styles.positive : styles.negative;
  } else {
    return isPositive ? styles.negative : styles.positive;
  }
}

/**
 * Gets the appropriate style for a bar based on column type.
 * Scenarios (ac, pp, fc, pl) use scenario styles.
 * Variances (d_, dr_) use variance styles with pos/neg/neu coloring.
 */
export function getBarStyle(
  scenario: string,
  value: number,
  isPositiveGood: boolean,
  styles: CellBarChartStyles,
): VarianceStyle {
  if (isScenarioColumn(scenario)) {
    return getScenarioStyle(scenario, styles);
  }
  return getVarianceStyle(value, isPositiveGood, styles);
}

/**
 * Gets the fill value for a bar - either solid color, pattern URL, or transparent with stroke.
 */
export function getBarFill(varianceStyle: VarianceStyle, patternPrefix: string): string {
  const pattern = varianceStyle.fillpattern;

  if (pattern === "hatched") {
    return `url(#${getPatternId(patternPrefix, varianceStyle.stroke)})`;
  }

  if (pattern === "outlined") {
    return "transparent";
  }

  // Default: solid fill
  return varianceStyle.fill;
}

/**
 * Gets the stroke for a bar based on pattern type.
 */
export function getBarStroke(varianceStyle: VarianceStyle): { stroke: string; strokeWidth: number } {
  const pattern = varianceStyle.fillpattern;

  if (pattern === "outlined") {
    return { stroke: varianceStyle.stroke, strokeWidth: 1.5 }; // scaled by caller via * s
  }

  // Solid and hatched bars don't need visible stroke
  return { stroke: "none", strokeWidth: 0 };
}

/**
 * Renders a zigzag break indicator at a given x position, matching the structure chart style.
 * Two mirrored zigzag lines with a white background covering the break gap.
 */
function renderZigzagBreak(breakX: number, breakGap: number, yTop: number, barHeight: number, s: number): unknown[] {
  const midX = breakX + breakGap / 2;
  const halfGap = breakGap * 0.35;
  const zigCount = 3;
  const segHeight = barHeight / zigCount;
  const amplitude = breakGap * 0.3;

  let leftPath = `M ${midX - halfGap} ${yTop}`;
  for (let i = 0; i < zigCount; i++) {
    const y1 = yTop + segHeight * (i + 0.5);
    const y2 = yTop + segHeight * (i + 1);
    leftPath += ` L ${midX - halfGap - amplitude} ${y1} L ${midX - halfGap} ${y2}`;
  }

  let rightPath = `M ${midX + halfGap} ${yTop}`;
  for (let i = 0; i < zigCount; i++) {
    const y1 = yTop + segHeight * (i + 0.5);
    const y2 = yTop + segHeight * (i + 1);
    rightPath += ` L ${midX + halfGap + amplitude} ${y1} L ${midX + halfGap} ${y2}`;
  }

  return [
    <rect x={breakX} y={yTop - 1} width={breakGap} height={barHeight + 2} fill="#ffffff" />,
    <path d={leftPath} fill="none" stroke="#000000" stroke-width={1 * s} />,
    <path d={rightPath} fill="none" stroke="#000000" stroke-width={1 * s} />,
  ];
}

/**
 * Renders an absolute variance bar chart (d_ prefix).
 * Horizontal bar with centered axis, green for positive, red for negative.
 * When a bar exceeds the geometry's cut width it is drawn as an overdrive bar:
 * base segment + zigzag break + proportional overdrive stub (like structure chart).
 *
 * Layout: [left label area][bar area with axis][right label area], summing to
 * exactly `columnWidthEm` em - see barColumnGeometry.ts.
 */
const AbsoluteVarianceBar: FunctionalComponent<CellBarChartProps> = (props) => {
  const {
    value,
    scenario,
    columnStats,
    height,
    isPositiveGood,
    formattedValue,
    measureScale,
    locale,
    decimalDigits,
    columnWidthEm = 10,
    labelWidths,
    sideMax,
    bold,
    styles = DEFAULT_STYLES,
  } = props;
  const s = styles.scaleFactor;
  const fs = styles.fontSize;

  const displayValue = formattedValue || formatValue(value, false, measureScale, locale, 0, true, decimalDigits);
  const sides =
    labelWidths ?? ownLabelWidths(columnStats, labelWidth(displayValue, fs, styles.fontFamily, false, bold));
  const isPositive = value > 0 || (value === 0 && zeroOnPositiveSide(sides));
  const { neg = Math.max(0, -columnStats.min), pos = Math.max(0, columnStats.max) } = sideMax ?? {};
  const geometry = absoluteBarGeometry(columnWidthEm, styles.emPx, sides, { neg, pos });
  const { totalWidth, axisX, labelGap } = geometry;
  const { breakGap, overdriveZoneWidth, cutWidth } = isPositive ? geometry.pos : geometry.neg;

  // Direct unit scaling via fontSize
  const scaledWidth = Math.abs(value) * styles.unitScaling * fs;
  // auto scaling puts the largest bar on the cut, float rounding must not turn it into an overdrive bar
  const isExtreme = scaledWidth - cutWidth > 1e-6;

  // Compute proportional overdrive width across the column
  const maxScaledWidth = (isPositive ? pos : neg) * styles.unitScaling * fs;
  const maxOverflow = Math.max(0, maxScaledWidth - cutWidth);
  const overflowAmount = Math.max(0, scaledWidth - cutWidth);
  const overdriveWidth = maxOverflow > 0 ? (overflowAmount / maxOverflow) * overdriveZoneWidth : 0;

  const { barY, barHeight } = barBox(height);

  // Get style based on column type (scenario vs variance)
  const look = getVarianceLook(scenario, styles);
  const sentimentStyle = getBarStyle(scenario, value, isPositiveGood, styles);
  const minuendPattern = look?.minuend.fillpattern;
  // the colour stays the sentiment, the pattern follows the minuend (AC solid, FC hatched, PL outlined)
  const barStyle =
    minuendPattern === "hatched" || minuendPattern === "outlined"
      ? { ...sentimentStyle, fillpattern: minuendPattern }
      : sentimentStyle;
  const patternPrefix = isScenarioColumn(scenario)
    ? getScenarioType(scenario)
    : isPositiveGood
      ? isPositive
        ? "pos"
        : "neg"
      : isPositive
        ? "neg"
        : "pos";
  const fillValue = getBarFill(barStyle, patternPrefix);
  // a hatched variance bar keeps an outline, the shared getBarStroke also serves the waterfall
  const { stroke: barStroke, strokeWidth: barStrokeWidth } =
    look && barStyle.fillpattern === "hatched" ? { stroke: barStyle.stroke, strokeWidth: 1 } : getBarStroke(barStyle);

  // bars start at the outer edge of the thick variance axis
  const axisOffset = look ? (VARIANCE_AXIS_EM * styles.emPx) / 2 : 0;
  const rootX = isPositive ? axisX + axisOffset : axisX - axisOffset;

  // Normal bar width (clamped to cutWidth when extreme)
  const baseBarWidth = isExtreme ? cutWidth : scaledWidth;

  // Label position accounts for overdrive
  const totalVisualWidth = isExtreme ? cutWidth + breakGap + overdriveWidth : scaledWidth;
  const labelX = isPositive ? rootX + totalVisualWidth + labelGap : rootX - totalVisualWidth - labelGap;
  const labelAnchor = isPositive ? "start" : "end";

  return (
    <svg width={totalWidth} height={height} class="cell-bar-chart absolute-variance" style={{ overflow: "visible" }}>
      <PatternDefs styles={styles} />

      {/* Center axis line */}
      {!look && <line x1={axisX} y1={0} x2={axisX} y2={height} stroke={AXIS_COLOR} stroke-width={1 * s} />}

      {/* Base bar */}
      {baseBarWidth > 0 && (
        <rect
          x={isPositive ? rootX : rootX - baseBarWidth}
          y={barY}
          width={baseBarWidth}
          height={barHeight}
          fill={fillValue}
          stroke={barStroke}
          stroke-width={barStrokeWidth * s}
        />
      )}

      {/* Overdrive: break gap + stub bar (only when extreme) */}
      {isExtreme && overdriveWidth > 0 && (
        <rect
          x={isPositive ? rootX + cutWidth + breakGap : rootX - cutWidth - breakGap - overdriveWidth}
          y={barY}
          width={overdriveWidth}
          height={barHeight}
          fill={fillValue}
          stroke={barStroke}
          stroke-width={barStrokeWidth * s}
        />
      )}

      {/* Zigzag break indicator between base and overdrive */}
      {isExtreme &&
        renderZigzagBreak(isPositive ? rootX + cutWidth : rootX - cutWidth - breakGap, breakGap, barY, barHeight, s)}

      {/* Variance axis on top, so no bar outline covers it */}
      {look && <VarianceAxis x={axisX} height={height} look={look} styles={styles} />}

      {/* Value label */}
      <text
        x={labelX}
        y={height / 2}
        dy="0.35em"
        text-anchor={labelAnchor}
        fill={styles.fontColor}
        font-size={fs}
        font-family={styles.fontFamily}
      >
        {displayValue}
      </text>
    </svg>
  );
};

/**
 * Renders a relative variance pin chart (dr_ prefix).
 * Line from the axis in the sentiment colour, ending in a square head in the look of the
 * minuend, with the value label beside the head like an absolute bar label. A pin beyond
 * the pin area is cut and ends in an arrow. Its label stands on the line behind the arrow
 * head, on a light band, or after the arrow tip when the line is too short for it.
 *
 * Layout: [left label area][pin area with axis][right label area], summing to exactly
 * `columnWidthEm` em - see barColumnGeometry.ts.
 * Uses percentageScaling to determine pin length (pixels per percentage point).
 */
const RelativeVariancePin: FunctionalComponent<CellBarChartProps> = (props) => {
  const {
    value,
    scenario,
    columnStats,
    height,
    isPositiveGood,
    formattedValue,
    measureScale,
    locale,
    percentDigits,
    percentSign,
    columnWidthEm = 10,
    labelWidths,
    sideMax,
    bold,
    styles = DEFAULT_STYLES,
  } = props;
  const s = styles.scaleFactor;
  const fs = styles.fontSize;
  const headSize = PIN_HEAD_SIZE * s;
  const pinPx = 100 * styles.percentageScaling * fs;

  const displayValue = formattedValue || formatValue(value, true, measureScale, locale, percentDigits, percentSign);
  const ownWidth = labelWidth(displayValue, fs, styles.fontFamily, true, bold);
  const sides = labelWidths ?? ownLabelWidths(columnStats, ownWidth);
  const { neg = Math.max(0, -columnStats.min), pos = Math.max(0, columnStats.max) } = sideMax ?? {};
  const { totalWidth, negPinLength, posPinLength, axisX, labelGap } = relativePinGeometry(
    columnWidthEm,
    styles.emPx,
    sides,
    headSize,
    { neg: neg * pinPx, pos: pos * pinPx },
  );

  const centerY = height / 2;

  // Direct unit scaling via fontSize
  const scaledLength = Math.abs(value) * pinPx;
  const isPositive = value > 0 || (value === 0 && zeroOnPositiveSide(sides));
  const maxPinLength = isPositive ? posPinLength : negPinLength;
  // auto scaling puts the longest pin on the limit, float rounding must not cut it
  const isExtreme = scaledLength - maxPinLength > 1e-6;
  const pinLength = Math.min(scaledLength, maxPinLength);

  const direction = isPositive ? 1 : -1;
  const pinEndX = axisX + direction * pinLength;

  // Get style based on column type (scenario vs variance)
  const barStyle = getBarStyle(scenario, value, isPositiveGood, styles);
  const look = getVarianceLook(scenario, styles);
  const headStyle = look?.minuend ?? styles.scenarios.ac;

  // the arrow tip lands on the outer edge of a full-length head, so the label after it stays in the cell
  const tipX = axisX + direction * (maxPinLength + headSize / 2);
  const arrowSize = PIN_ARROW_RATIO * headSize;
  const arrowBaseX = tipX - direction * arrowSize;
  // the band keeps a pad of full line to the arrow head and to the axis, else the label goes after the tip
  const bandPad = PIN_BAND_PAD * fs;
  const bandWidth = ownWidth + 2 * bandPad;
  const shaftLength = Math.abs(arrowBaseX - axisX) - (VARIANCE_AXIS_EM * styles.emPx) / 2;
  const labelOnShaft = isExtreme && shaftLength >= bandWidth + 2 * bandPad;
  const bandX = arrowBaseX - direction * (bandPad + bandWidth / 2) - bandWidth / 2;
  const labelX = labelOnShaft
    ? bandX + bandWidth / 2
    : (isExtreme ? tipX : pinEndX + direction * (headSize / 2)) + direction * labelGap;

  return (
    <svg width={totalWidth} height={height} class="cell-bar-chart relative-variance" style={{ overflow: "visible" }}>
      <PatternDefs styles={styles} />

      {/* Square head, or an arrow when the pin is cut */}
      {isExtreme ? (
        <polygon
          points={`${tipX},${centerY} ${arrowBaseX},${centerY - arrowSize / 2} ${arrowBaseX},${centerY + arrowSize / 2}`}
          fill={barStyle.fill}
        />
      ) : (
        <rect
          x={pinEndX - headSize / 2}
          y={centerY - headSize / 2}
          width={headSize}
          height={headSize}
          fill={
            headStyle.fillpattern === "outlined"
              ? "#ffffff"
              : headStyle.fillpattern === "hatched"
                ? `url(#${getHeadPatternId(look?.minuendSlot ?? "ac", headStyle.stroke)})`
                : headStyle.fill
          }
          stroke={headStyle.stroke}
          stroke-width={1 * s}
        />
      )}

      {/* Pin line over the head, so it visibly ends in its centre as in the charts */}
      <line
        x1={axisX}
        y1={centerY}
        x2={isExtreme ? arrowBaseX : pinEndX}
        y2={centerY}
        stroke={barStyle.fill}
        stroke-width={PIN_LINE_WIDTH * s}
      />

      {/* Light band over the line, so the label on it stays readable */}
      {labelOnShaft && (
        <rect
          class="pin-label-band"
          x={bandX}
          y={centerY - (PIN_LINE_WIDTH * s) / 2}
          width={bandWidth}
          height={PIN_LINE_WIDTH * s}
          fill="#ffffff"
          fill-opacity="0.5"
        />
      )}

      {/* Axis on top, so a head near zero does not cover it */}
      {look ? (
        <VarianceAxis x={axisX} height={height} look={look} styles={styles} />
      ) : (
        <line x1={axisX} y1={0} x2={axisX} y2={height} stroke={AXIS_COLOR} stroke-width={1 * s} />
      )}

      {/* Value label - uses fontColor from styles, italics per IBCS for relative variance */}
      <text
        x={labelX}
        y={height / 2}
        dy="0.35em"
        text-anchor={labelOnShaft ? "middle" : isPositive ? "start" : "end"}
        fill={styles.fontColor}
        font-size={fs}
        font-style="italic"
        font-family={styles.fontFamily}
      >
        {displayValue}
      </text>
    </svg>
  );
};

/**
 * CellBarChart - Renders IBCS-compliant variance bar charts.
 *
 * Absolute variance (d_ prefix): Horizontal bars with centered axis
 * Relative variance (dr_ prefix): Pin charts with a square head and value indication
 *
 * Uses componentStyle patterns from chart components for consistent styling.
 */
export const CellBarChart: FunctionalComponent<CellBarChartProps> = (props) => {
  const { value, columnStats, isRelative, styles = DEFAULT_STYLES } = props;

  // Handle invalid values
  if (value === null || value === undefined || isNaN(value) || !columnStats || columnStats.absMax === 0) {
    return (
      <span class="bar-chart-empty" style={{ color: styles.fontColor, fontStyle: "italic" }}>
        -
      </span>
    );
  }

  if (isRelative) {
    return <RelativeVariancePin {...props} />;
  }

  return <AbsoluteVarianceBar {...props} />;
};
