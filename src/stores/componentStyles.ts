import { createStore } from "@stencil/store";

export interface Style {
  global: GlobalStyle;
  "bn-text": TextStyle
  "bn-chart": ChartStyle
}

export interface GlobalStyle {
  fontSize: string;
  fontFamily: string
}
export interface TextStyle { }
export interface ChartStyle { }
const { state, on, get, set } = createStore<{ [key: string]: Style }>(
  {
    "_system": {
      global: {
        "fontFamily": "'NotoSans', sans-serif",
        "fontSize":   "13.3333px"
      },
      "bn-text": {},
      "bn-chart":{}
    }
  }
);

export { on, get, set };
export default state;
