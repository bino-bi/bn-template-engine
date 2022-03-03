import { createStore } from "@stencil/store";

export interface Style {
  global: GlobalStyle;
  "bn-text": TextStyle
}

export interface GlobalStyle {
  baseFontSize: number;
  baseFontFamily: string
}
export interface TextStyle { }

const { state, on, get, set } = createStore<{ [key: string]: Style }>(
  {
    "_system": {
      global: {
        baseFontSize: 13.3333,
        baseFontFamily: "'NotoSans', sans-serif"
      },
      "bn-text": {}
    }
  }
);

export { on, get, set };
export default state;
