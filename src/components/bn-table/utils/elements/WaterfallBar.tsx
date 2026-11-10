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
  getVarianceLook,
  PatternDefs,
  VarianceAxis,
} from "./CellBarChart";
import { WaterfallBarData, WaterfallRowKind } from "../helper/WaterfallCalculator";
import { labelWidth, VARIANCE_AXIS_EM, waterfallGeometry, WaterfallGeometry } from "../helper/barColumnGeometry";

export interface WaterfallBarProps extends CellBarChartProps {
  waterfall: WaterfallBarData;
  /** Column geometry from the measured labels of all rows; without it the fixed gutters count. */
  geometry?: WaterfallGeometry;
  /** The row prints bold, so the label is measured bold. */
  bold?: boolean;
  /** How far the connectors and the variance axis run out of the svg to meet the row above and below, in px. */
  connectorReach?: { top: number; bottom: number };
}

/**
 * Label text of a waterfall bar. Scenario values carry no variance sentiment: unsigned per
 * IBCS. A variance keeps its sign (`signed`).
 */
export function waterfallLabelText(
  value: number,
  kind: WaterfallRowKind,
  measureScale: number | undefined,
  locale: string | undefined,
  decimalDigits: number | undefined,
  signed: boolean = false,
): string {
  const text = formatValue(value, kind === "partof", measureScale, locale, 0, true, decimalDigits);
  return signed ? text : text.replace(/^\+/, "");
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
 *
 * An absolute variance column is drawn as a variance waterfall: the bar in the color of
 * the sentiment and the pattern of the minuend, the axis in the look of the reference
 * scenario in every row, a signed label, and thin connectors to the rows above and below
 * in place of the dashed guides. The axis and the connectors join the rows, so where one
 * meets the label it is only interrupted over the height of the text.
 */
export const WaterfallBar: FunctionalComponent<WaterfallBarProps> = (props) => {
  const {
    value,
    scenario,
    height,
    isPositiveGood,
    measureScale,
    locale,
    decimalDigits,
    columnWidthEm = 10,
    styles = DEFAULT_STYLES,
    waterfall,
    geometry,
    bold,
    connectorReach = { top: 0, bottom: 0 },
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

  // null for a scenario column, which ignores the sentiment
  const look = getVarianceLook(scenario, styles);
  const sentimentStyle = getBarStyle(scenario, value, isPositiveGood, styles);
  const minuendPattern = look?.minuend.fillpattern;
  const barStyle =
    minuendPattern === "hatched" || minuendPattern === "outlined"
      ? { ...sentimentStyle, fillpattern: minuendPattern }
      : sentimentStyle;
  const patternPrefix = look ? (sentimentStyle === styles.positive ? "pos" : "neg") : getScenarioType(scenario);
  const fillValue = getBarFill(barStyle, patternPrefix);
  const { stroke: barStroke, strokeWidth: barStrokeWidth } =
    look && barStyle.fillpattern === "hatched" ? { stroke: barStyle.stroke, strokeWidth: 1 } : getBarStroke(barStyle);

  const displayValue = waterfallLabelText(value, waterfall.kind, measureScale, locale, decimalDigits, look !== null);

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
  // the parts of a vertical line of a variance waterfall that stay clear of the label text
  const labelTop = height / 2 - fs / 2;
  const labelBottom = height / 2 + fs / 2;
  const clearOfLabel = (x: number, y1: number, y2: number, halfWidth = 0): [number, number][] =>
    x + halfWidth > labelFrom && x - halfWidth < labelTo
      ? [[y1, Math.min(y2, labelTop)] as [number, number], [Math.max(y1, labelBottom), y2] as [number, number]].filter(
          ([from, to]) => to > from,
        )
      : [[y1, y2]];
  const axisTop = -connectorReach.top;
  const axisBottom = height + connectorReach.bottom;

  return (
    <svg
      width={totalWidth}
      height={height}
      class={`cell-bar-chart waterfall-bar${look ? " variance-waterfall" : ""}`}
      style={{ overflow: "visible" }}
    >
      <PatternDefs styles={styles} />

      {/* Zero axis line, drawn in the rows so the column reads as one chart */}
      {!look && !meetsLabel(axisX) && (
        <line x1={axisX} y1={0} x2={axisX} y2={height} stroke={AXIS_COLOR} stroke-width={1 * s} />
      )}

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

      {/* Connectors under the bar, out of the svg so they meet over the row borders */}
      {waterfall.connectors?.map(({ at, part }) =>
        clearOfLabel(xOf(at), part === "bottom" ? barY + barHeight : axisTop, part === "top" ? barY : axisBottom).map(
          ([y1, y2]) => (
            <line
              class="waterfall-connector"
              x1={xOf(at)}
              y1={y1}
              x2={xOf(at)}
              y2={y2}
              stroke={AXIS_COLOR}
              stroke-width={1 * s}
            />
          ),
        ),
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

      {/* Variance axis on top, so no bar outline covers it; it runs out of the svg like the connectors */}
      {look &&
        clearOfLabel(axisX, axisTop, axisBottom, (VARIANCE_AXIS_EM * styles.emPx) / 2).map(([y1, y2]) => (
          <g transform={`translate(0,${y1})`}>
            <VarianceAxis x={axisX} height={y2 - y1} look={look} styles={styles} />
          </g>
        ))}

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
