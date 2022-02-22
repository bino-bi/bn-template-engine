import {createStore} from "@stencil/store";

export interface ContextStore {
  locale: string
  baseFontSize: number;
  baseFontFamily: string;
}

const {state, on, get, set} = createStore<ContextStore>({
  locale: 'en',
  baseFontSize: 13.3333,
  baseFontFamily: "'NotoSans', sans-serif"
});

export {on, get, set};
export default state;
