import { createStore } from "@stencil/store";
import { ScaleFactorsTimeChart } from "../components/bn-chart-time/utils/model";
import { SVGStyleGroup, SVGVariancesStyleGroup } from "../utils/model";
import { ScaleFactorsStructureChart } from "../components/bn-chart-structure/utils/model";
// import {SVGStyleGroup, SVGVariancesStyleGroup} from "@bino-bi/ibcs-component/dist/types/utils/model";

// import {IScaleFactorsStructureChart, IScaleFactorsTimeChart} from "@bino-bi/ibcs-component-interface";

export interface TreeChartStyle {
  edgeColor: string;
  edgeWidth: number;
  operatorCircleRadius: number;
  operatorFontSizeScale: number; // Scale factor relative to global.fontSizePx
  operatorColor: string;
}

export interface GridStyle {
  headerBackground: string;
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
}

export interface Style {
  global: GlobalStyle;
  "bn-text": TextStyle;
  "bn-chart-time": TimeChartStyle;
  "bn-chart-structure": StructureChartStyle;
  "bn-chart-tree": TreeChartStyle;
  "bn-grid": GridStyle;
}

export interface GlobalStyle {
  fontSizePx: number;
  fontFamily: string;
  fontColor: string;
  fontBackgroundColor: string;
}

export interface TextStyle {
}

export interface TimeChartStyle {
  scaleFactors: ScaleFactorsTimeChart;
  axisStyles: SVGStyleGroup;
  barStyles: SVGStyleGroup;
  varianceStyles: SVGVariancesStyleGroup;
  padding: {
    top: number,
    left: number,
    right: number,
    bottom: number,
  };
}

export interface StructureChartStyle {
  scaleFactors: ScaleFactorsStructureChart;
  axisStyles: SVGStyleGroup;
  barStyles: SVGStyleGroup;
  varianceStyles: SVGVariancesStyleGroup;
  padding: {
    top: number,
    left: number,
    right: number,
    bottom: number,
  };
}

const { state, on, get, set } = createStore<{ [key: string]: Style }>(
  {
    "_system": {
      global: {
        "fontFamily": "'Noto Sans', sans-serif",
        "fontSizePx": 13.3333,
        "fontColor": "#000000",
        "fontBackgroundColor": "#ffffff",
      },
      "bn-text": {},
      "bn-chart-time":{
        "scaleFactors": {
          scenarioOffset:        0.3,
          scenarioLabelToColumn: 0.3,
          labelToColumn:          0.3,
          labelToAxis:           0.3,
          needleWidth:           0.3,
          needleHeadWidth:       0.6,
          columnWidth:           2.0,
          varianceAxisLineWidth: 0.3,
          axisLineWidth:         0.1,
          auxiliaryLineWidth:    0.1,
          scenarioLineWidth:     0.2,
          markerWidth:           0.7,
          markerOffset:          0.0,
          categoryWidth:         3.0,
          axisTickLength:        0.3,
        },
        "axisStyles": {
          ac: { stroke: "#121212", fill: "#121212", width: 0.1 },
          fc: { stroke: "#121212", fill: "#ffffff", width: 0.1, "dasharray": "10 5 5 5" },
          pp: { stroke: "#606060", fill: "#606060", width: 0.1 },
          pl: { stroke: "#121212", fill: "#ffffff", width: 0.1 },
        },
        "barStyles": {
          ac: { stroke: "#404040", fill: "#404040", width: 0.1 },
          fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "fc" },
          pp: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1 },
          pl: { stroke: "#404040", fill: "#ffffff", width: 0.1 },
        },
        "varianceStyles": {
          pos: { stroke: "#008f96", fill: "#008f96", width: 0.1 },
          neg: { stroke: "#ff0000", fill: "#ff0000", width: 0.1 },
          neu: { stroke: "#808080", fill: "#808080", width: 0.1 },
        },
        "padding": {
          top: 10,
          left: 10,
          right: 10,
          bottom: 10,
        },
      },
      "bn-chart-structure": {
        "scaleFactors": {
          scenarioOffset:        0.3,
          scenarioLabelToBar:    0.1,
          labelToBar:            0.3,
          labelToAxis:           0.3,
          needleWidth:           0.3,
          needleHeadWidth:       0.6,
          barWidth:              1.2,
          varianceAxisLineWidth: 0.3,
          axisLineWidth:         0.1,
          auxiliaryLineWidth:    0.1,
          scenarioLineWidth:     0.2,
          markerWidth:           0.7,
          markerOffset:          0.0,
          categoryWidth:         1.9,
          axisTickLength:        0.3,
        },
        "axisStyles": {
          ac: { stroke: "#121212", fill: "#121212", width: 0.1 },
          fc: { stroke: "#121212", fill: "#ffffff", width: 0.1, "dasharray": "10 5 5 5" },
          pp: { stroke: "#606060", fill: "#606060", width: 0.1 },
          pl: { stroke: "#121212", fill: "#ffffff", width: 0.1 },
        },
        "barStyles": {
          ac: { stroke: "#404040", fill: "#404040", width: 0.1 },
          fc: { stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "fc" },
          pp: { stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1 },
          pl: { stroke: "#404040", fill: "#ffffff", width: 0.1 },
        },
        "varianceStyles": {
          pos: { stroke: "#008f96", fill: "#008f96", width: 0.1 },
          neg: { stroke: "#ff0000", fill: "#ff0000", width: 0.1 },
          neu: { stroke: "#808080", fill: "#808080", width: 0.1 },
        },
        "padding": {
          top: 10,
          left: 10,
          right: 10,
          bottom: 10,
        },
      },
      "bn-chart-tree": {
        "edgeColor": "#404040",
        "edgeWidth": 1,
        "operatorCircleRadius": 10,
        "operatorFontSizeScale": 0.9, // Relative to global.fontSizePx
        "operatorColor": "#404040",
      },
      "bn-grid": {
        "headerBackground": "transparent",
        "borderColor": "#A6A6A6",
        "borderWidth": 1,
        "cellPadding": 4,
      },
    }
  }
);

export { on, get, set };
export default state;
