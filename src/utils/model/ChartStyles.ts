import { Pattern } from "@svgdotjs/svg.js";
import { ScaleFactorsStructureChart } from "../../components/bn-chart-structure/utils/model";
import { ScaleFactorsTimeChart } from "../../components/bn-chart-time/utils/model";

export interface BinoChartSyles {
  scaleFactors: ScaleFactorsTimeChart | ScaleFactorsStructureChart | null;
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

export interface SVGStyleGroup {
  ac: SVGStyle;
  fc: SVGStyle;
  pp: SVGStyle;
  pl: SVGStyle;

  [index: string]: SVGStyle;
}

export interface SVGVariancesStyleGroup {
  pos: SVGStyle;
  neg: SVGStyle;
  neu: SVGStyle;

  [index: string]: SVGStyle;
}

export interface SVGPolgonPattern {
  foreground: string;
  background: string;
  bgOffset: number;
  pattern?: Pattern;
}

export interface SVGStyle {
  stroke: string;
  fill: string;
  width: number;
  dasharray?: string;
  fillpattern?: string;
}
