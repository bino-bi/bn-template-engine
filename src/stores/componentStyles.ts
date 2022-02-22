import {createStore} from "@stencil/store";

const defaultChart = {
  "scaleFactors": {
    barWidthYOffset: 0.95,
    fontNettoHeight: 0.7,
    needleWidthOffset: 0.7,
    barHeightOffset: 0.4,
    barWidthOffset: 0.3,
    pt2Px: 1.2,
    axisWidth: 0.1,
    rowHeight: 1.8,
  },
  "fontStyles": {
    font: "sans-serif",
    size: 13.3333,
    color: "#000000",
    backgroud: "#ffffff",
    leading: 1.8,
  },
  "axisStyles": {
    ac: {stroke: "#121212", fill: "#121212", width: 0.1},
    fc: {stroke: "#121212", fill: "#ffffff", width: 0.1, "dasharray": "10 5 5 5"},
    pp: {stroke: "#606060", fill: "#606060", width: 0.1},
    pl: {stroke: "#121212", fill: "#ffffff", width: 0.1},
  },
  "barStyles": {
    ac: {stroke: "#404040", fill: "#404040", width: 0.1},
    fc: {stroke: "#404040", fill: "#ffffff", width: 0.5, fillpattern: "fc"},
    pp: {stroke: "#A6A6A6", fill: "#A6A6A6", width: 0.1},
    pl: {stroke: "#404040", fill: "#ffffff", width: 0.1},
  },
  "varianceStyles": {
    pos: {stroke: "#008f96", fill: "#008f96", width: 0.1},
    neg: {stroke: "#ff0000", fill: "#ff0000", width: 0.1},
    neu: {stroke: "#808080", fill: "#808080", width: 0.1},
  },
  "padding": {
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
  }
};


const {state, on, get, set} = createStore({
  "bn-page": {},
  "bn-chart": defaultChart,
  "bn-text": {},
});

export {on, get, set};
export default state;
