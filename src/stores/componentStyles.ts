import { createStore } from "@stencil/store";
import {
  SVGStyleGroup,
  SVGVariancesStyleGroup
} from "@bino-bi/ibcs-component/dist/types/components/ibcs-chart-structure/utils/model";

export interface Style {
  global: GlobalStyle;
  "bn-text": TextStyle;
  "bn-chart": ChartStyle;
}

export interface GlobalStyle {
  fontSizePx: number;
  fontFamily: string;
}

export interface TextStyle {
}

export interface ChartStyle {
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
      },
      "bn-text": {},
      "bn-chart": {
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
    }
  }
);

export { on, get, set };
export default state;
/*
"padding": {
  top: 10,
    left: 10,
    right: 10,
    bottom: 10,
},
"pattern": null,*/
