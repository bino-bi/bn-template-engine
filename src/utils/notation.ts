/**
 * The scenario looks that are not part of the style JSON, and the notation
 * that `<bn-context>` hands out with `getNotation()`.
 *
 * The time chart draws its lines, markers and areas from the constants here.
 * `getNotation()` returns the same values, so a chart that is not part of
 * this package can draw like the charts that are.
 *
 * @module utils/notation
 */
import { Style } from "../stores/componentStyles";
import { SVGStyle } from "./model/styles/SVGStyle";

export const NOTATION_API_VERSION = 1;

/** Dash pattern of a forecast line and of the year separator of the time chart. */
export const DASH_ARRAY = "4,4";

/** Look of a line series: the line and its markers. */
export interface LineSeriesStyle {
  markerFill: string;
  markerStroke: string;
  lineColor: string;
  lineDashArray?: string;
}

/**
 * IBCS Color Schema for Line Chart:
 * | Scenario | Marker Fill | Marker Stroke | Line Style |
 * |----------|-------------|---------------|------------|
 * | AC       | Black       | Black         | Solid      |
 * | PP       | Gray (#999) | Gray          | Solid      |
 * | FC       | White       | Black         | Dashed     |
 * | PL       | White       | Black         | Solid      |
 */
export const IBCS_LINE_STYLES: Record<string, LineSeriesStyle> = {
  ac: { markerFill: "#000000", markerStroke: "#000000", lineColor: "#000000" },
  pp: { markerFill: "#999999", markerStroke: "#999999", lineColor: "#999999" },
  fc: { markerFill: "#ffffff", markerStroke: "#000000", lineColor: "#000000", lineDashArray: DASH_ARRAY },
  pl: { markerFill: "#ffffff", markerStroke: "#000000", lineColor: "#000000" },
};

/** Look of a stacked area: the fill and the line on its upper edge. */
export interface AreaStyle {
  fill: string;
  opacity: number;
  lineColor: string;
  dashArray?: string;
}

/**
 * IBCS-style area fill colors for stacked area charts.
 */
export const SCENARIO_AREA_STYLES: Record<string, AreaStyle> = {
  ac: { fill: "#000000", opacity: 0.3, lineColor: "#000000" },
  pp: { fill: "#999999", opacity: 0.3, lineColor: "#999999" },
  fc: { fill: "#000000", opacity: 0.2, lineColor: "#000000", dashArray: DASH_ARRAY },
  pl: { fill: "#000000", opacity: 0.1, lineColor: "#000000" },
};

/** Bar or variance look as the style JSON has it. `width` is a multiple of the font size. */
export type NotationShapeStyle = Pick<SVGStyle, "stroke" | "fill" | "width"> &
  Partial<Pick<SVGStyle, "fillpattern" | "dasharray">>;

/** How one scenario type is drawn. */
export interface NotationScenario {
  /** The `bn-chart-time.barStyles` entry of the scenario. */
  bar: NotationShapeStyle;
  line: { color: string; dashArray?: string };
  marker: { fill: string; stroke: string };
  area: AreaStyle;
}

/** Result of `getNotation()` on `<bn-context>`. */
export interface Notation {
  /** Raised when a field is removed, renamed or changes its meaning. New fields keep it. */
  apiVersion: typeof NOTATION_API_VERSION;
  /** `global.fontFamily` of the style. */
  fontFamily: string;
  /** `global.fontSizePx` of the style. */
  fontSizePx: number;
  scenarios: Record<"ac" | "pp" | "fc" | "pl", NotationScenario>;
  /** `bn-chart-time.varianceStyles` of the style. */
  variance: Record<"pos" | "neg" | "neu", NotationShapeStyle>;
  /** Value of every `<bn-scaling-group>` of the context, by name. */
  scalingGroups: Record<string, number>;
}

const scenario = (style: Style, key: "ac" | "pp" | "fc" | "pl"): NotationScenario => {
  const line = IBCS_LINE_STYLES[key];
  return {
    bar: { ...style["bn-chart-time"].barStyles[key] },
    line: { color: line.lineColor, ...(line.lineDashArray && { dashArray: line.lineDashArray }) },
    marker: { fill: line.markerFill, stroke: line.markerStroke },
    area: { ...SCENARIO_AREA_STYLES[key] },
  };
};

/**
 * Builds the notation from a merged style and the scaling group store.
 * A group that was removed is still a key of the store, with no value.
 */
export function buildNotation(style: Style, scalingGroups: Record<string, number | undefined>): Notation {
  const variance = style["bn-chart-time"].varianceStyles;
  return {
    apiVersion: NOTATION_API_VERSION,
    fontFamily: style.global.fontFamily,
    fontSizePx: style.global.fontSizePx,
    scenarios: {
      ac: scenario(style, "ac"),
      pp: scenario(style, "pp"),
      fc: scenario(style, "fc"),
      pl: scenario(style, "pl"),
    },
    variance: { pos: { ...variance.pos }, neg: { ...variance.neg }, neu: { ...variance.neu } },
    scalingGroups: Object.fromEntries(
      Object.entries(scalingGroups).filter((entry): entry is [string, number] => entry[1] !== undefined),
    ),
  };
}
