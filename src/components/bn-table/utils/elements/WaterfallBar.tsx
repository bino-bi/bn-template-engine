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
import { WaterfallBarData } from "../helper/WaterfallCalculator";
import { waterfallGeometry } from "../helper/barColumnGeometry";

export interface WaterfallBarProps extends CellBarChartProps {
  waterfall: WaterfallBarData;
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
 * guides marking their parent bar's extent.
 */
export const WaterfallBar: FunctionalComponent<WaterfallBarProps> = (props) => {
  const {
    value,
    scenario,
    height,
    measureScale,
    locale,
    columnWidthEm = 10,
    styles = DEFAULT_STYLES,
    waterfall,
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

  const { totalWidth, labelAreaWidth, barAreaWidth, labelGap } = waterfallGeometry(columnWidthEm, styles.emPx);
  const pxPerUnit = barAreaWidth / range;
  const xOf = (coordinate: number) => labelAreaWidth + (coordinate - waterfall.min) * pxPerUnit;

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

  // Scenario values carry no variance sentiment - labels are unsigned per IBCS
  const displayValue = formatValue(value, waterfall.kind === "partof", measureScale, locale).replace(/^\+/, "");

  const pointsLeft = endX < startX;
  const labelX = pointsLeft ? barX - labelGap : barX + barWidth + labelGap;
  const labelAnchor = pointsLeft ? "end" : "start";

  return (
    <svg width={totalWidth} height={height} class="cell-bar-chart waterfall-bar" style={{ overflow: "visible" }}>
      <PatternDefs styles={styles} />

      {/* Zero axis line, drawn in every row so the column reads as one chart */}
      <line x1={axisX} y1={0} x2={axisX} y2={height} stroke={AXIS_COLOR} stroke-width={1 * s} />

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
      {waterfall.parentStart !== undefined && waterfall.parentEnd !== undefined && (
        <line
          x1={xOf(waterfall.parentEnd)}
          y1={0}
          x2={xOf(waterfall.parentEnd)}
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
