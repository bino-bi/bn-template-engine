import {createStore} from "@stencil/store";

const {state, on, get, set} = createStore({
  "bn-chart": {},
  "bn-text": {},
});

export {on, get, set};
export default state;
