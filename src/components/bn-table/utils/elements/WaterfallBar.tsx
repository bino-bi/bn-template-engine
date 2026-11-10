import { h, FunctionalComponent } from "@stencil/core";
import {
  AXIS_COLOR,
  CellBarChartProps,
  DEFAULT_STYLES,
  formatValue,
  getBarFill,
  getBarStroke,
  getBarStyle,
  getScenarioType,
  PatternDefs,
} from "./CellBarChart";
import { WaterfallBarData, WaterfallRowKind } from "../helper/WaterfallCalculator";
import { labelWidth, waterfallGeometry, WaterfallGeometry } from "../helper/barColumnGeometry";

export interface WaterfallBarProps extends CellBarChartProps {
  waterfall: WaterfallBarData;
  /** Column geometry from the measured labels of all rows; without it the fixed gutters count. */
  geometry?: WaterfallGeometry;
  /** The row prints bold, so the label is measured bold. */
  bold?: boolean;
}

/** Label text of a waterfall bar. Scenario values carry no variance sentiment: unsigned per IBCS. */
export function waterfallLabelText(
  value: number,
  kind: WaterfallRowKind,
  measureScale: number | undefined,
  locale: string | undefined,
  decimalDigits: number | undefined,
): string {
  return formatValue(value, kind === "partof", measureScale, locale, 0, true, decimalDigits).replace(/^\+/, "");
}

/**
 * Renders one row of an IBCS waterfall for a scenario bar column.
 *
 * All rows of a column share the same coordinate system: the geometry's
 * min/max extents (value units, always including zero) are mapped onto the
 * bar area, so bars always fit and the zero axis sits at the same x position
 * in every row. Fixed unit scaling is deliberately not applied - a clipped
 * bar would break the start position of every subsequent bar.
 *
 * Layout: [left label area][bar area][right label area]
 * The value label sits at the bar's free end (right of rightward bars,
 * left of leftward bars). thereof/partof rows additionally get dashed
 * guides marking their parent bar's extent. A guide or axis line that would
 * run through the label is left out in that row.
 */
export const WaterfallBar: FunctionalComponent<WaterfallBarProps> = (props) => {
  const {
    value,
    scenario,
    height,
    measureScale,
    locale,
    decimalDigits,
    columnWidthEm = 10,
    styles = DEFAULT_STYLES,
    waterfall,
    geometry,
    bold,
  } = props;
  const s = styles.scaleFactor;
  const fs = styles.fontSize;

  const range = waterfall.max - waterfall.min;

  if (value === null || value === undefined || isNaN(value) || range <= 0) {
    return (
      <span class="bar-chart-empty" style={{ color: styles.fontColor, fontStyle: "italic" }}>
        -
      </span>
    );
  }

  const { totalWidth, labelAreaLeft, barAreaWidth, labelGap } =
    geometry ?? waterfallGeometry(columnWidthEm, styles.emPx);
  const pxPerUnit = barAreaWidth / range;
  const xOf = (coordinate: number) => labelAreaLeft + (coordinate - waterfall.min) * pxPerUnit;

  const padding = 2 * s;
  const barHeight = height - padding * 2;
  const barY = padding;
  const axisX = xOf(0);

  const startX = xOf(waterfall.start);
  const endX = xOf(waterfall.end);
  const barX = Math.min(startX, endX);
  const barWidth = Math.abs(endX - startX);

  const barStyle = getBarStyle(scenario, value, false, styles);
  const fillValue = getBarFill(barStyle, getScenarioType(scenario));
  const { stroke: barStroke, strokeWidth: barStrokeWidth } = getBarStroke(barStyle);

  const displayValue = waterfallLabelText(value, waterfall.kind, measureScale, locale, decimalDigits);

  const pointsLeft = endX < startX;
  const labelX = pointsLeft ? barX - labelGap : barX + barWidth + labelGap;
  const labelAnchor = pointsLeft ? "end" : "start";

  // a line through the label makes it unreadable, so the row drops it
  const labelSize = labelWidth(displayValue, fs, styles.fontFamily, false, bold);
  const labelPad = labelGap / 2;
  const labelFrom = (pointsLeft ? labelX - labelSize : labelX) - labelPad;
  const labelTo = (pointsLeft ? labelX : labelX + labelSize) + labelPad;
  const meetsLabel = (x: number) => x > labelFrom && x < labelTo;
  const parentEndX = waterfall.parentEnd !== undefined ? xOf(waterfall.parentEnd) : undefined;

  return (
    <svg width={totalWidth} height={height} class="cell-bar-chart waterfall-bar" style={{ overflow: "visible" }}>
      <PatternDefs styles={styles} />

      {/* Zero axis line, drawn in the rows so the column reads as one chart */}
      {!meetsLabel(axisX) && <line x1={axisX} y1={0} x2={axisX} y2={height} stroke={AXIS_COLOR} stroke-width={1 * s} />}

      {/* Dashed guides marking the parent bar extent of a sub-cascade */}
      {waterfall.parentStart !== undefined && waterfall.parentEnd !== undefined && (
        <line
          x1={xOf(waterfall.parentStart)}
          y1={0}
          x2={xOf(waterfall.parentStart)}
          y2={height}
          stroke={AXIS_COLOR}
          stroke-width={1 * s}
          stroke-dasharray={`${2 * s},${2 * s}`}
        />
      )}
      {waterfall.parentStart !== undefined && parentEndX !== undefined && !meetsLabel(parentEndX) && (
        <line
          x1={parentEndX}
          y1={0}
          x2={parentEndX}
          y2={height}
          stroke={AXIS_COLOR}
          stroke-width={1 * s}
          stroke-dasharray={`${2 * s},${2 * s}`}
        />
      )}

      {/* Waterfall segment */}
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

      {/* Value label at the bar's free end */}
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
