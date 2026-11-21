import { Pattern } from "@svgdotjs/svg.js";
import { ScaleFactorsStructureChart } from "../../components/bn-chart-structure/utils/model";
import { ScaleFactorsTimeChart } from "../../components/bn-chart-time/utils/model";
import { ScaleFactorsXYChart } from "../xy/model/ScaleFactorsXYChart";
import { FillPattern } from "./styles/SVGStyle";

/** Resolved chart styling configuration combining scale factors, fonts, scenario colors, and SVG patterns. */
export interface BinoChartSyles {
  scaleFactors: ScaleFactorsTimeChart | ScaleFactorsStructureChart | ScaleFactorsXYChart | null;
  fontStyles: {
    font: string;
    size: number;
    color: string;
    background: string;
    leading: number;
  };
  axisStyles: SVGStyleGroup;
  barStyles: SVGStyleGroup;
  varianceStyles: SVGVariancesStyleGroup;
  padding: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
  pattern: Map<string, SVGPolgonPattern>;
}

/**
 * IBCS scenario visual encoding for SVG elements.
 * Each key maps to the standard IBCS rendering:
 * ac=solid dark, fc=hatched, pp=light gray, pl=outlined.
 */
export interface SVGStyleGroup {
  ac: SVGStyle;
  fc: SVGStyle;
  pp: SVGStyle;
  pl: SVGStyle;

  [index: string]: SVGStyle;
}

/** IBCS traffic-light coloring for variance bars: pos=favorable (green), neg=unfavorable (red), neu=neutral. */
export interface SVGVariancesStyleGroup {
  pos: SVGStyle;
  neg: SVGStyle;
  neu: SVGStyle;

  [index: string]: SVGStyle;
}

/** SVG polygon fill pattern definition - used for forecast (FC) hatching with foreground/background layers. */
export interface SVGPolgonPattern {
  foreground: string;
  background: string;
  /** Vertical offset between foreground and background polygon layers. */
  bgOffset: number;
  pattern?: Pattern;
}

export interface SVGStyle {
  stroke: string;
  fill: string;
  width: number;
  dasharray?: string;
  fillpattern?: FillPattern;
  /** Fill of a column or bar with a value below 0. */
  negativeFill?: string;
  /** Variance styles: fill of an outlined variance (a variance of a plan). Not set: the background. */
  outlineFill?: string;
  /** Variance styles: edge of an outlined variance. Not set: the colour of the variance. */
  outlineStroke?: string;
}
