import { h, FunctionalComponent } from "@stencil/core";
import { ColumnStats } from "./Cell";

export interface VarianceStyle {
  stroke: string;
  fill: string;
  fillpattern?: string;  // Pattern type: 'solid', 'hatched', 'outlined'
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
  unitScaling: number;       // Pixels per unit for absolute variance
  percentageScaling: number; // Pixels per percentage point for relative variance
  scaleFactor: number;       // Proportional scaling factor for all pixel constants
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
  styles?: CellBarChartStyles;
}

// Default fallback colors (should come from componentStyle)
const DEFAULT_STYLES: CellBarChartStyles = {
  positive: { stroke: '#008f96', fill: '#008f96', fillpattern: 'solid' },
  negative: { stroke: '#ff0000', fill: '#ff0000', fillpattern: 'solid' },
  neutral: { stroke: '#808080', fill: '#808080', fillpattern: 'outlined' },
  scenarios: {
    ac: { stroke: '#404040', fill: '#404040', fillpattern: 'solid' },
    pp: { stroke: '#A6A6A6', fill: '#A6A6A6', fillpattern: 'solid' },
    fc: { stroke: '#404040', fill: '#ffffff', fillpattern: 'hatched' },
    pl: { stroke: '#404040', fill: '#ffffff', fillpattern: 'outlined' },
  },
  fontColor: '#000000',
  fontSize: 11,
  fontFamily: "'Noto Sans', sans-serif",
  unitScaling: 0.01,       // Default: 1000 units = 10 pixels
  percentageScaling: 0.5,  // Default: 100% = 50 pixels
  scaleFactor: 1
};

const AXIS_COLOR = '#666666';

/**
 * Creates a unique pattern ID for the SVG defs
 */
function getPatternId(prefix: string, color: string): string {
  return `pattern-${prefix}-${color.replace('#', '')}`;
}

/**
 * Renders SVG pattern definitions for hatched fills
 */
const PatternDefs: FunctionalComponent<{ styles: CellBarChartStyles }> = ({ styles }) => {
  const s = styles.scaleFactor;
  const patternSize = 6 * s;
  const patterns: { id: string; stroke: string; fill: string }[] = [
    { id: getPatternId('pos', styles.positive.stroke), stroke: styles.positive.stroke, fill: styles.positive.fill },
    { id: getPatternId('neg', styles.negative.stroke), stroke: styles.negative.stroke, fill: styles.negative.fill },
    { id: getPatternId('neu', styles.neutral.stroke), stroke: styles.neutral.stroke, fill: styles.neutral.fill },
  ];

  return (
    <defs>
      {patterns.map(p => (
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
function formatValue(value: number, isRelative: boolean, measureScale: number = 1): string {
  let scaledValue: number;
  let absValue: number;
  const prefix = value >= 0 ? '+' : '';

  if (isRelative) {
    // Relative variance is stored as decimal (e.g., -2.0 = -200%)
    // Multiply by 100 to get percentage value for display
    scaledValue = value * 100;
    absValue = Math.abs(scaledValue);
    // Show as integer percentage with % suffix
    return prefix + Math.round(scaledValue).toString() + '%';
  } else {
    // Absolute variance - apply measure scale and use SI prefixes
    scaledValue = value / measureScale;
    absValue = Math.abs(scaledValue);

    let formatted: string;
    if (absValue >= 1000000000) {
      formatted = (scaledValue / 1000000000).toFixed(absValue >= 10000000000 ? 0 : 1) + 'B';
    } else if (absValue >= 1000000) {
      formatted = (scaledValue / 1000000).toFixed(absValue >= 10000000 ? 0 : 1) + 'M';
    } else if (absValue >= 1000) {
      formatted = (scaledValue / 1000).toFixed(absValue >= 10000 ? 0 : 1) + 'K';
    } else {
      formatted = scaledValue.toFixed(absValue >= 10 ? 0 : 1);
    }

    // Remove trailing .0 if present
    formatted = formatted.replace(/\.0([KMB]?)$/, '$1');

    return prefix + formatted;
  }
}

/**
 * Checks if the column is a scenario column (ac, pp, fc, pl) vs variance (d_, dr_).
 */
function isScenarioColumn(scenario: string): boolean {
  const scenarioPrefix = scenario.slice(0, 2).toLowerCase();
  return ['ac', 'pp', 'fc', 'pl'].includes(scenarioPrefix);
}

/**
 * Gets the scenario type from the column name (ac, pp, fc, pl).
 */
function getScenarioType(scenario: string): 'ac' | 'pp' | 'fc' | 'pl' {
  const scenarioPrefix = scenario.slice(0, 2).toLowerCase();
  if (scenarioPrefix === 'pp') return 'pp';
  if (scenarioPrefix === 'fc') return 'fc';
  if (scenarioPrefix === 'pl') return 'pl';
  return 'ac'; // default
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
function getBarStyle(scenario: string, value: number, isPositiveGood: boolean, styles: CellBarChartStyles): VarianceStyle {
  if (isScenarioColumn(scenario)) {
    return getScenarioStyle(scenario, styles);
  }
  return getVarianceStyle(value, isPositiveGood, styles);
}

/**
 * Gets the fill value for a bar - either solid color, pattern URL, or transparent with stroke.
 */
function getBarFill(varianceStyle: VarianceStyle, patternPrefix: string): string {
  const pattern = varianceStyle.fillpattern;

  if (pattern === 'hatched') {
    return `url(#${getPatternId(patternPrefix, varianceStyle.stroke)})`;
  }

  if (pattern === 'outlined') {
    return 'transparent';
  }

  // Default: solid fill
  return varianceStyle.fill;
}

/**
 * Gets the stroke for a bar based on pattern type.
 */
function getBarStroke(varianceStyle: VarianceStyle): { stroke: string; strokeWidth: number } {
  const pattern = varianceStyle.fillpattern;

  if (pattern === 'outlined') {
    return { stroke: varianceStyle.stroke, strokeWidth: 1.5 };  // scaled by caller via * s
  }

  // Solid and hatched bars don't need visible stroke
  return { stroke: 'none', strokeWidth: 0 };
}

/**
 * Renders an absolute variance bar chart (d_ prefix).
 * Horizontal bar with centered axis, green for positive, red for negative.
 * Value label shown next to the bar (black text per IBCS).
 *
 * Layout: [left label area][bar area with axis][right label area]
 * Uses unitScaling to determine bar width (pixels per unit of measure).
 */
const AbsoluteVarianceBar: FunctionalComponent<CellBarChartProps> = (props) => {
  const { value, scenario, height, isPositiveGood, formattedValue, measureScale, styles = DEFAULT_STYLES } = props;
  const s = styles.scaleFactor;

  const labelAreaWidth = 50 * s;
  const maxBarWidth = 40 * s;
  const barAreaWidth = maxBarWidth * 2;
  const totalWidth = labelAreaWidth + barAreaWidth + labelAreaWidth;

  const padding = 2 * s;
  const barHeight = height - padding * 2;
  const axisX = labelAreaWidth + maxBarWidth; // Axis in center of bar area

  // Calculate bar width using unitScaling (pixels per unit)
  // Clamp to maxBarWidth to prevent overflow
  const scaledWidth = Math.abs(value) * styles.unitScaling * s;
  const barWidth = Math.min(scaledWidth, maxBarWidth);

  const isPositive = value >= 0;
  const barX = isPositive ? axisX : axisX - barWidth;
  const barY = padding;

  // Get style based on column type (scenario vs variance)
  const barStyle = getBarStyle(scenario, value, isPositiveGood, styles);
  // Pattern prefix for scenarios uses scenario type, for variances uses pos/neg
  const patternPrefix = isScenarioColumn(scenario)
    ? getScenarioType(scenario)
    : (isPositiveGood ? (isPositive ? 'pos' : 'neg') : (isPositive ? 'neg' : 'pos'));
  const fillValue = getBarFill(barStyle, patternPrefix);
  const { stroke: barStroke, strokeWidth: barStrokeWidth } = getBarStroke(barStyle);

  const displayValue = formattedValue || formatValue(value, false, measureScale);

  // Label position: in the label area on the appropriate side
  // Positive values: label in right area, left-aligned
  // Negative values: label in left area, right-aligned
  const labelX = isPositive ? axisX + barWidth + 4 * s : axisX - barWidth - 4 * s;
  const labelAnchor = isPositive ? 'start' : 'end';

  return (
    <svg width={totalWidth} height={height} class="cell-bar-chart absolute-variance" style={{ overflow: 'visible' }}>
      <PatternDefs styles={styles} />

      {/* Center axis line */}
      <line
        x1={axisX}
        y1={0}
        x2={axisX}
        y2={height}
        stroke={AXIS_COLOR}
        stroke-width={1 * s}
      />

      {/* Bar */}
      {barWidth > 0 && (
        <rect
          x={barX}
          y={barY}
          width={barWidth}
          height={barHeight}
          fill={fillValue}
          stroke={barStroke}
          stroke-width={barStrokeWidth * s}
        />
      )}

      {/* Value label - uses fontColor from styles */}
      <text
        x={labelX}
        y={height / 2}
        dy="0.35em"
        text-anchor={labelAnchor}
        fill={styles.fontColor}
        font-size={styles.fontSize}
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
  const { value, scenario, height, isPositiveGood, formattedValue, measureScale, styles = DEFAULT_STYLES } = props;
  const s = styles.scaleFactor;

  const maxPinLength = 25 * s;
  const pinAreaWidth = maxPinLength * 2 + 10 * s;
  const labelAreaWidth = 70 * s;
  const totalWidth = pinAreaWidth + labelAreaWidth;

  const axisX = pinAreaWidth / 2;
  const centerY = height / 2;

  // Calculate pin length using percentageScaling (pixels per percentage point)
  // Value is in decimal form (e.g., 0.5 = 50%), multiply by 100 to get percentage
  const percentValue = Math.abs(value) * 100;
  const scaledLength = percentValue * styles.percentageScaling * s;
  const pinLength = Math.min(scaledLength, maxPinLength);

  const isPositive = value >= 0;
  const pinEndX = isPositive ? axisX + pinLength : axisX - pinLength;

  // Get style based on column type (scenario vs variance)
  const barStyle = getBarStyle(scenario, value, isPositiveGood, styles);
  const dotRadius = 3 * s;

  // Show arrow for extreme values (when pin would exceed max length)
  const isExtreme = scaledLength > maxPinLength;

  const displayValue = formattedValue || formatValue(value, true, measureScale);

  // Label always on the right side after the pin area
  const labelX = pinAreaWidth + 4 * s;

  return (
    <svg width={totalWidth} height={height} class="cell-bar-chart relative-variance" style={{ overflow: 'visible' }}>
      {/* Center axis line */}
      <line
        x1={axisX}
        y1={0}
        x2={axisX}
        y2={height}
        stroke={AXIS_COLOR}
        stroke-width={1 * s}
      />

      {/* Dot at end - always black, only shown when NOT extreme, rendered first so line is on top */}
      {!isExtreme && (
        <circle
          cx={pinEndX}
          cy={centerY}
          r={dotRadius}
          fill={styles.fontColor}
        />
      )}

      {/* Pin line - colored based on column type, on top of dot */}
      <line
        x1={axisX}
        y1={centerY}
        x2={pinEndX}
        y2={centerY}
        stroke={barStyle.fill}
        stroke-width={2 * s}
      />

      {/* Arrow indicator for extreme positive values (pointing right) */}
      {isExtreme && isPositive && (
        <polygon
          points={`${pinAreaWidth - 2 * s},${centerY} ${pinAreaWidth - 8 * s},${centerY - 3 * s} ${pinAreaWidth - 8 * s},${centerY + 3 * s}`}
          fill={barStyle.fill}
        />
      )}

      {/* Arrow indicator for extreme negative values (pointing left) */}
      {isExtreme && !isPositive && (
        <polygon
          points={`${2 * s},${centerY} ${8 * s},${centerY - 3 * s} ${8 * s},${centerY + 3 * s}`}
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
        font-size={styles.fontSize}
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
    return <span class="bar-chart-empty" style={{ color: styles.fontColor, fontStyle: 'italic' }}>-</span>;
  }

  if (isRelative) {
    return <RelativeVariancePin {...props} />;
  }

  return <AbsoluteVarianceBar {...props} />;
};
