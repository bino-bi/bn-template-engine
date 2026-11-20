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
import { ScaleFactorsBulletChart } from "../components/bn-chart-bullet/utils/model/BulletChartStyle";
import { ScaleFactorsXYChart } from "../utils/xy/model/ScaleFactorsXYChart";
import { XY_SERIES_PALETTE } from "../utils/xy/SeriesPalette";

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
  /** Background colour of every data cell. `cell-background` on the child of a cell wins. */
  cellBackground: string;
  /** Cell caption (`cell-captions`): font size in px. */
  captionFontSize: number;
  captionFontWeight: string;
  captionColor: string;
  /** Space below a cell caption, in px. */
  captionGap: number;
}

/** Optional overrides for `bn-layout-card`. */
export interface LayoutCardStyle {
  /** Font size of the card title in px. Without it the title has the font size of `global.fontSizePx`. */
  titleFontSize?: number;
}

/** Top-level style object grouping global defaults and per-component overrides. */
export interface Style {
  global: GlobalStyle;
  "bn-text": TextStyle;
  "bn-chart-time": TimeChartStyle;
  "bn-chart-structure": StructureChartStyle;
  "bn-chart-scatter": XYChartStyle;
  "bn-chart-bubble": XYChartStyle;
  "bn-chart-bullet": BulletChartStyle;
  "bn-tree": TreeStyle;
  "bn-grid": GridStyle;
  "bn-layout-card": LayoutCardStyle;
  "bn-annotation": AnnotationStyle;
}

/** Colours of the marks of `bn-annotation-layer` and the circles of `bn-annotation-list`. */
export interface AnnotationStyle {
  /** The colour of a mark without a `color`, and of the circles of the list. */
  color: string;
  /** The colours a mark can name in its `color`. */
  colors: Record<string, string>;
  /** A numbered circle is filled with the colour, or white with a ring and a number in the colour. */
  markerStyle: "filled" | "outlined";
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
  stackColors: string[];
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
  stackColors: string[];
  /** The title above the axis in bold: the chart title, or the name of the variance. */
  titleBold: boolean;
  padding: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

/**
 * IBCS styling for `bn-chart-bullet`: scale factors, scenario colors for the
 * actual bar and target marker, variance colors, the qualitative range-band
 * grays (max two bands), and padding.
 */
export interface BulletChartStyle {
  scaleFactors: ScaleFactorsBulletChart;
  axisStyles: SVGStyleGroup;
  barStyles: SVGStyleGroup;
  varianceStyles: SVGVariancesStyleGroup;
  rangeColors: string[];
  padding: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

/**
 * IBCS styling for the XY charts (`bn-chart-scatter`, `bn-chart-bubble`):
 * scale factors, axis styles, the series hue palette, and padding.
 *
 * Axis style roles: `ac` = plot frame, `pp` = gridlines, `fc` = reference
 * lines and iso-curves, `pl` = highlight band fill.
 */
export interface XYChartStyle {
  scaleFactors: ScaleFactorsXYChart;
  axisStyles: SVGStyleGroup;
  seriesColors: string[];
  /** The outline of a filled dot or bubble, and the opacity (0 to 1) of its fill. */
  markStyles: { stroke: string; opacity: number };
  /** Fill per series, in the order of `seriesColors`: `solid` or `outline` (a line in the series colour around a nearly clear fill). */
  seriesFills: string[];
  /** Colour of the share slice of a bubble per series, in the order of `seriesColors`. Without an entry: a darker shade of the series colour. */
  shareColors: string[];
  padding: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

const xyChartStyleDefaults = (): XYChartStyle => ({
  scaleFactors: {
    pointRadius: 0.4,
    bubbleMaxRadius: 3.2,
    bubbleMinRadius: 0.35,
    axisTickLength: 0.35,
    labelToMark: 0.3,
    legendSwatch: 0.9,
    panelGap: 1.6,
    refLineWidth: 0.075,
    gridLineWidth: 0.075,
  },
  axisStyles: {
    ac: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 1 },
    fc: { stroke: "#808080", fill: "#808080", width: 1 },
    pp: { stroke: "#D9D9D9", fill: "#D9D9D9", width: 1 },
    pl: { stroke: "#EFEFEF", fill: "#EFEFEF", width: 1 },
  },
  seriesColors: [...XY_SERIES_PALETTE],
  markStyles: { stroke: "#ffffff", opacity: 1 },
  seriesFills: [],
  shareColors: [],
  padding: {
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
  },
});

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
      fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "hatched" },
      pp: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1 },
      pl: { stroke: "#404040", fill: "#ffffff", width: 0.1 },
    },
    varianceStyles: {
      pos: { stroke: "#008f96", fill: "#008f96", width: 0.1 },
      neg: { stroke: "#ff0000", fill: "#ff0000", width: 0.1 },
      neu: { stroke: "#808080", fill: "#808080", width: 0.1 },
    },
    stackColors: ["#000000", "#c0c0c0", "#808080"],
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
      fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "hatched" },
      pp: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1 },
      pl: { stroke: "#404040", fill: "#ffffff", width: 0.1 },
    },
    varianceStyles: {
      pos: { stroke: "#008f96", fill: "#008f96", width: 0.1 },
      neg: { stroke: "#ff0000", fill: "#ff0000", width: 0.1 },
      neu: { stroke: "#808080", fill: "#808080", width: 0.1 },
    },
    stackColors: ["#000000", "#c0c0c0", "#808080"],
    titleBold: false,
    padding: {
      top: 10,
      left: 10,
      right: 10,
      bottom: 10,
    },
  },
  "bn-chart-scatter": xyChartStyleDefaults(),
  "bn-chart-bubble": xyChartStyleDefaults(),
  "bn-chart-bullet": {
    scaleFactors: {
      rowHeight: 1.9,
      barHeight: 0.66,
      varianceHeight: 0.4,
      targetTickHeight: 1.1,
      targetLineWidth: 0.15,
      axisLineWidth: 0.075,
      labelToBar: 0.3,
      labelToAxis: 0.3,
      axisTickLength: 0.35,
      tickStripHeight: 1.2,
    },
    axisStyles: {
      ac: { stroke: "#121212", fill: "#121212", width: 0.1 },
      fc: { stroke: "#121212", fill: "#ffffff", width: 0.1, dasharray: "10 5 5 5" },
      pp: { stroke: "#606060", fill: "#606060", width: 0.1 },
      pl: { stroke: "#121212", fill: "#ffffff", width: 0.1 },
    },
    barStyles: {
      ac: { stroke: "#404040", fill: "#404040", width: 0.1 },
      fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, dasharray: "4 3" },
      pp: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1 },
      pl: { stroke: "#404040", fill: "#ffffff", width: 0.1 },
    },
    varianceStyles: {
      pos: { stroke: "#008f96", fill: "#008f96", width: 0.1 },
      neg: { stroke: "#ff0000", fill: "#ff0000", width: 0.1 },
      neu: { stroke: "#808080", fill: "#808080", width: 0.1 },
    },
    rangeColors: ["#D9D9D9", "#EFEFEF"],
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
    cellBackground: "transparent",
    captionFontSize: 12,
    captionFontWeight: "bold",
    captionColor: "#000000",
    captionGap: 2,
  },
  "bn-layout-card": {} as LayoutCardStyle,
  "bn-annotation": {
    color: "#0070c0",
    colors: { negative: "#ff0000", positive: "#008f96" },
    markerStyle: "filled",
  },
};

/** Keys that are optional, so the defaults do not list them. */
const OPTIONAL_KEYS: Record<string, string[]> = {
  "bn-text": ["fontFamily", "fontSizePx", "fontColor", "fontBackgroundColor", "leading"],
  "bn-layout-card": ["titleFontSize"],
};
// The keys of these groups are checked too. The style groups (`axisStyles.ac`, ...) are not: their keys differ per scenario.
const CHECKED_GROUPS = ["scaleFactors", "padding"];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * The keys of a style body that no component reads, as paths
 * (e.g. `bn-chart-time.scaleFactors.labelToColum`). Such a key is ignored
 * when the style is applied, so a typo would otherwise go unnoticed.
 */
export function unknownStyleKeys(style: unknown): string[] {
  const unknown: string[] = [];
  if (!isPlainObject(style)) {
    return unknown;
  }

  const defaults = SYSTEM_STYLE_DEFAULTS as unknown as Record<string, Record<string, unknown>>;
  for (const [section, value] of Object.entries(style)) {
    if (!(section in defaults)) {
      unknown.push(section);
      continue;
    }
    if (!isPlainObject(value)) {
      continue;
    }
    const sectionKeys = [...Object.keys(defaults[section]), ...(OPTIONAL_KEYS[section] ?? [])];
    for (const [key, group] of Object.entries(value)) {
      if (!sectionKeys.includes(key)) {
        unknown.push(`${section}.${key}`);
      } else if (CHECKED_GROUPS.includes(key) && isPlainObject(group)) {
        const groupKeys = Object.keys(defaults[section][key] as object);
        unknown.push(
          ...Object.keys(group)
            .filter((name) => !groupKeys.includes(name))
            .map((name) => `${section}.${key}.${name}`),
        );
      }
    }
  }
  return unknown;
}
