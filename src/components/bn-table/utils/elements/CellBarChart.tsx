import { h, FunctionalComponent } from "@stencil/core";
import { ColumnStats } from "./Cell";

export interface VarianceStyle {
  stroke: string;
  fill: string;
  fillpattern?: string; // Pattern type: 'solid', 'hatched', 'outlined'
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
  fontSize: number;
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
  maxBarWidth?: number;
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
  fontSize: 11,
  fontFamily: "'Noto Sans', sans-serif",
  unitScaling: 0.01, // Default: 100 units per em of bar
  percentageScaling: 0.5, // Default: 2 percentage points per em of pin
  scaleFactor: 1,
};

export const AXIS_COLOR = "#666666";

/**
 * Creates a unique pattern ID for the SVG defs
 */
function getPatternId(prefix: string, color: string): string {
  return `pattern-${prefix}-${color.replace("#", "")}`;
}

/**
 * Renders SVG pattern definitions for hatched fills
 */
export const PatternDefs: FunctionalComponent<{ styles: CellBarChartStyles }> = ({ styles }) => {
  const s = styles.scaleFactor;
  const patternSize = 6 * s;
  const patterns: { id: string; stroke: string; fill: string }[] = [
    { id: getPatternId("pos", styles.positive.stroke), stroke: styles.positive.stroke, fill: styles.positive.fill },
    { id: getPatternId("neg", styles.negative.stroke), stroke: styles.negative.stroke, fill: styles.negative.fill },
    { id: getPatternId("neu", styles.neutral.stroke), stroke: styles.neutral.stroke, fill: styles.neutral.fill },
    ...(["ac", "pp", "fc", "pl"] as const).map((type) => ({
      id: getPatternId(type, styles.scenarios[type].stroke),
      stroke: styles.scenarios[type].stroke,
      fill: styles.scenarios[type].fill,
    })),
  ];

  return (
    <defs>
      {patterns.map((p) => (
        <pattern id={p.id} patternUnits="userSpaceOnUse" width={patternSize} height={patternSize}>
          <rect width={patternSize} height={patternSize} fill="#ffffff" />
          <line x1="0" y1={patternSize} x2={patternSize} y2="0" stroke={p.stroke} stroke-width={1.5 * s} />
        </pattern>
      ))}
    </defs>
  );
};

/**
 * Formats a number for display with appropriate SI prefix.
 */
export function formatValue(value: number, isRelative: boolean, measureScale: number = 1): string {
  let scaledValue: number;
  let absValue: number;
  const prefix = value >= 0 ? "+" : "";

  if (isRelative) {
    // Relative variance is stored as decimal (e.g., -2.0 = -200%)
    // Multiply by 100 to get percentage value for display
    scaledValue = value * 100;
    // Show as integer percentage with % suffix
    return prefix + Math.round(scaledValue).toString() + "%";
  } else {
    // Absolute variance - apply measure scale and use SI prefixes
    scaledValue = value / measureScale;
    absValue = Math.abs(scaledValue);

    let formatted: string;
    if (absValue >= 1000000000) {
      formatted = (scaledValue / 1000000000).toFixed(absValue >= 10000000000 ? 0 : 1) + "B";
    } else if (absValue >= 1000000) {
      formatted = (scaledValue / 1000000).toFixed(absValue >= 10000000 ? 0 : 1) + "M";
    } else if (absValue >= 1000) {
      formatted = (scaledValue / 1000).toFixed(absValue >= 10000 ? 0 : 1) + "K";
    } else {
      formatted = scaledValue.toFixed(absValue >= 10 ? 0 : 1);
    }

    // Remove trailing .0 if present
    formatted = formatted.replace(/\.0([KMB]?)$/, "$1");

    return prefix + formatted;
  }
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
 * When a bar exceeds maxBarWidth it is drawn as an overdrive bar:
 * base segment + zigzag break + proportional overdrive stub (like structure chart).
 *
 * Layout: [left label area][bar area with axis][right label area]
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
    maxBarWidth: maxBarWidthEm = 10,
    styles = DEFAULT_STYLES,
  } = props;
  const s = styles.scaleFactor;
  const fs = styles.fontSize;

  const labelAreaWidth = 38 * s;
  const maxBarWidth = maxBarWidthEm * fs;

  // Overdrive layout constants
  const breakGap = 4 * s;
  const overdriveZoneWidth = maxBarWidth * 0.15;
  const cutWidth = maxBarWidth - breakGap - overdriveZoneWidth;

  // Direct unit scaling via fontSize
  const scaledWidth = Math.abs(value) * styles.unitScaling * fs;
  const isExtreme = scaledWidth > cutWidth;

  // Compute proportional overdrive width across the column
  const maxScaledWidth = columnStats.absMax * styles.unitScaling * fs;
  const maxOverflow = Math.max(0, maxScaledWidth - cutWidth);
  const overflowAmount = Math.max(0, scaledWidth - cutWidth);
  const overdriveWidth = maxOverflow > 0 ? (overflowAmount / maxOverflow) * overdriveZoneWidth : 0;

  // Adaptive axis placement based on data range
  const hasNeg = columnStats.min < 0;
  const hasPos = columnStats.max > 0;
  const negBarWidth = hasNeg ? maxBarWidth : 0;
  const posBarWidth = hasPos ? maxBarWidth : 0;
  const barAreaWidth = negBarWidth + posBarWidth;
  const totalWidth = (hasNeg ? labelAreaWidth : 0) + barAreaWidth + (hasPos ? labelAreaWidth : 0);

  const padding = 2 * s;
  const barHeight = height - padding * 2;
  const axisX = (hasNeg ? labelAreaWidth : 0) + negBarWidth;
  const barY = padding;
  const isPositive = value >= 0;

  // Get style based on column type (scenario vs variance)
  const barStyle = getBarStyle(scenario, value, isPositiveGood, styles);
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
  const { stroke: barStroke, strokeWidth: barStrokeWidth } = getBarStroke(barStyle);

  const displayValue = formattedValue || formatValue(value, false, measureScale);

  // Normal bar width (clamped to cutWidth when extreme)
  const baseBarWidth = isExtreme ? cutWidth : scaledWidth;

  // Label position accounts for overdrive
  const totalVisualWidth = isExtreme ? cutWidth + breakGap + overdriveWidth : scaledWidth;
  const labelX = isPositive ? axisX + totalVisualWidth + 4 * s : axisX - totalVisualWidth - 4 * s;
  const labelAnchor = isPositive ? "start" : "end";

  return (
    <svg width={totalWidth} height={height} class="cell-bar-chart absolute-variance" style={{ overflow: "visible" }}>
      <PatternDefs styles={styles} />

      {/* Center axis line */}
      <line x1={axisX} y1={0} x2={axisX} y2={height} stroke={AXIS_COLOR} stroke-width={1 * s} />

      {/* Base bar */}
      {baseBarWidth > 0 && (
        <rect
          x={isPositive ? axisX : axisX - baseBarWidth}
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
          x={isPositive ? axisX + cutWidth + breakGap : axisX - cutWidth - breakGap - overdriveWidth}
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
        renderZigzagBreak(isPositive ? axisX + cutWidth : axisX - cutWidth - breakGap, breakGap, barY, barHeight, s)}

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
 * Thin horizontal line from axis with dot at end and value label.
 *
 * Layout: [pin area with axis][label area on right]
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
    maxBarWidth: maxBarWidthEm = 10,
    styles = DEFAULT_STYLES,
  } = props;
  const s = styles.scaleFactor;
  const fs = styles.fontSize;

  // Pin length is ~2/3 of bar width for visual balance
  const maxPinLength = Math.round(maxBarWidthEm * 0.67 * fs);
  const pinPadding = 5 * s;

  // Adaptive axis placement based on data range
  const hasNeg = columnStats.min < 0;
  const hasPos = columnStats.max > 0;
  const negPinWidth = hasNeg ? maxPinLength + pinPadding : 0;
  const posPinWidth = hasPos ? maxPinLength + pinPadding : 0;
  const pinAreaWidth = negPinWidth + posPinWidth;
  const labelAreaWidth = 45 * s;
  const totalWidth = pinAreaWidth + labelAreaWidth;

  const axisX = negPinWidth;
  const centerY = height / 2;

  // Direct unit scaling via fontSize
  const percentValue = Math.abs(value) * 100;
  const scaledLength = percentValue * styles.percentageScaling * fs;
  const isExtreme = scaledLength > maxPinLength;
  const pinLength = Math.min(scaledLength, maxPinLength);

  const isPositive = value >= 0;
  const pinEndX = isPositive ? axisX + pinLength : axisX - pinLength;

  // Get style based on column type (scenario vs variance)
  const barStyle = getBarStyle(scenario, value, isPositiveGood, styles);
  const dotRadius = 3 * s;

  const displayValue = formattedValue || formatValue(value, true, measureScale);

  // Label always on the right side after the pin area
  const labelX = pinAreaWidth + 4 * s;

  return (
    <svg width={totalWidth} height={height} class="cell-bar-chart relative-variance" style={{ overflow: "visible" }}>
      {/* Center axis line */}
      <line x1={axisX} y1={0} x2={axisX} y2={height} stroke={AXIS_COLOR} stroke-width={1 * s} />

      {/* Dot at end - shown when NOT extreme, rendered first so line is on top */}
      {!isExtreme && <circle cx={pinEndX} cy={centerY} r={dotRadius} fill={styles.fontColor} />}

      {/* Pin line - colored based on column type, on top of dot */}
      <line x1={axisX} y1={centerY} x2={pinEndX} y2={centerY} stroke={barStyle.fill} stroke-width={2 * s} />

      {/* Arrow indicator for extreme positive values */}
      {isExtreme && isPositive && (
        <polygon
          points={`${axisX + maxPinLength},${centerY} ${axisX + maxPinLength - 6 * s},${centerY - 3 * s} ${axisX + maxPinLength - 6 * s},${centerY + 3 * s}`}
          fill={barStyle.fill}
        />
      )}

      {/* Arrow indicator for extreme negative values */}
      {isExtreme && !isPositive && (
        <polygon
          points={`${axisX - maxPinLength},${centerY} ${axisX - maxPinLength + 6 * s},${centerY - 3 * s} ${axisX - maxPinLength + 6 * s},${centerY + 3 * s}`}
          fill={barStyle.fill}
        />
      )}

      {/* Value label - uses fontColor from styles, italics per IBCS for relative variance */}
      <text
        x={labelX}
        y={height / 2}
        dy="0.35em"
        text-anchor="start"
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
 * Relative variance (dr_ prefix): Pin/dot charts with value indication
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
