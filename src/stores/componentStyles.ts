/**
 * Reactive store for component theming and visual configuration.
 *
 * Styles are resolved through a three-layer merge:
 * 1. `_system` -- IBCS-compliant defaults (colors, font sizes, scale factors)
 * 2. `_default` -- optional user-level overrides applied globally
 * 3. Named themes -- component-specific overrides referenced by a style prop
 *
 * The `withStyled` mixin merges these layers at render time so that every
 * visualization inherits consistent IBCS styling while remaining customizable.
 *
 * @module stores/componentStyles
 */
import { ScaleFactorsTimeChart } from "../components/bn-chart-time/utils/model";
import { SVGStyleGroup, SVGVariancesStyleGroup } from "../utils/model";
import { ScaleFactorsStructureChart } from "../components/bn-chart-structure/utils/model";

/** Visual properties for `bn-tree` node edges and operator badges. */
export interface TreeStyle {
  edgeColor: string;
  edgeWidth: number;
  operatorCircleRadius: number;
  operatorFontSizeScale: number; // Scale factor relative to global.fontSizePx
  operatorColor: string;
}

/** Visual properties for `bn-grid` headers, borders, and cell spacing. */
export interface GridStyle {
  headerBackground: string;
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
}

/** Top-level style object grouping global defaults and per-component overrides. */
export interface Style {
  global: GlobalStyle;
  "bn-text": TextStyle;
  "bn-chart-time": TimeChartStyle;
  "bn-chart-structure": StructureChartStyle;
  "bn-tree": TreeStyle;
  "bn-grid": GridStyle;
}

/** Baseline typography inherited by all components unless overridden. */
export interface GlobalStyle {
  fontSizePx: number;
  fontFamily: string;
  fontColor: string;
  fontBackgroundColor: string;
}

/** Optional typography overrides for the `bn-text` component. */
export interface TextStyle {
  fontFamily?: string;
  fontSizePx?: number;
  fontColor?: string;
  fontBackgroundColor?: string;
  leading?: number;
}

/** IBCS styling for `bn-chart-time`: scale factors, scenario colors, and padding. */
export interface TimeChartStyle {
  scaleFactors: ScaleFactorsTimeChart;
  axisStyles: SVGStyleGroup;
  barStyles: SVGStyleGroup;
  varianceStyles: SVGVariancesStyleGroup;
  padding: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

/** IBCS styling for `bn-chart-structure`: scale factors, scenario colors, and padding. */
export interface StructureChartStyle {
  scaleFactors: ScaleFactorsStructureChart;
  axisStyles: SVGStyleGroup;
  barStyles: SVGStyleGroup;
  varianceStyles: SVGVariancesStyleGroup;
  padding: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

export const SYSTEM_STYLE_DEFAULTS: Style = {
  global: {
    fontFamily: "'Noto Sans', sans-serif",
    fontSizePx: 13.3333,
    fontColor: "#000000",
    fontBackgroundColor: "#ffffff",
  },
  "bn-text": {} as TextStyle,
  "bn-chart-time": {
    scaleFactors: {
      scenarioOffset: 0.3,
      scenarioLabelToColumn: 0.3,
      labelToColumn: 0.3,
      labelToAxis: 0.3,
      needleWidth: 0.3,
      needleHeadWidth: 0.6,
      columnWidth: 2.0,
      varianceAxisLineWidth: 0.3,
      axisLineWidth: 0.1,
      auxiliaryLineWidth: 0.1,
      scenarioLineWidth: 0.2,
      markerWidth: 0.7,
      markerOffset: 0.0,
      categoryWidth: 3.0,
      axisTickLength: 0.3,
    },
    axisStyles: {
      ac: { stroke: "#121212", fill: "#121212", width: 0.1 },
      fc: { stroke: "#121212", fill: "#ffffff", width: 0.1, dasharray: "10 5 5 5" },
      pp: { stroke: "#606060", fill: "#606060", width: 0.1 },
      pl: { stroke: "#121212", fill: "#ffffff", width: 0.1 },
    },
    barStyles: {
      ac: { stroke: "#404040", fill: "#404040", width: 0.1 },
      fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "fc" },
      pp: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1 },
      pl: { stroke: "#404040", fill: "#ffffff", width: 0.1 },
    },
    varianceStyles: {
      pos: { stroke: "#008f96", fill: "#008f96", width: 0.1 },
      neg: { stroke: "#ff0000", fill: "#ff0000", width: 0.1 },
      neu: { stroke: "#808080", fill: "#808080", width: 0.1 },
    },
    padding: {
      top: 10,
      left: 10,
      right: 10,
      bottom: 10,
    },
  },
  "bn-chart-structure": {
    scaleFactors: {
      scenarioOffset: 0.3,
      scenarioLabelToBar: 0.1,
      labelToBar: 0.3,
      labelToAxis: 0.3,
      needleWidth: 0.3,
      needleHeadWidth: 0.6,
      barWidth: 1.2,
      varianceAxisLineWidth: 0.3,
      axisLineWidth: 0.1,
      auxiliaryLineWidth: 0.1,
      scenarioLineWidth: 0.2,
      markerWidth: 0.7,
      markerOffset: 0.0,
      categoryWidth: 1.9,
      axisTickLength: 0.3,
    },
    axisStyles: {
      ac: { stroke: "#121212", fill: "#121212", width: 0.1 },
      fc: { stroke: "#121212", fill: "#ffffff", width: 0.1, dasharray: "10 5 5 5" },
      pp: { stroke: "#606060", fill: "#606060", width: 0.1 },
      pl: { stroke: "#121212", fill: "#ffffff", width: 0.1 },
    },
    barStyles: {
      ac: { stroke: "#404040", fill: "#404040", width: 0.1 },
      fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "fc" },
      pp: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1 },
      pl: { stroke: "#404040", fill: "#ffffff", width: 0.1 },
    },
    varianceStyles: {
      pos: { stroke: "#008f96", fill: "#008f96", width: 0.1 },
      neg: { stroke: "#ff0000", fill: "#ff0000", width: 0.1 },
      neu: { stroke: "#808080", fill: "#808080", width: 0.1 },
    },
    padding: {
      top: 10,
      left: 10,
      right: 10,
      bottom: 10,
    },
  },
  "bn-tree": {
    edgeColor: "#404040",
    edgeWidth: 1,
    operatorCircleRadius: 10,
    operatorFontSizeScale: 0.9,
    operatorColor: "#404040",
  },
  "bn-grid": {
    headerBackground: "transparent",
    borderColor: "#A6A6A6",
    borderWidth: 1,
    cellPadding: 4,
  },
};
