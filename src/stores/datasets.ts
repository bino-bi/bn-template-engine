import {createStore} from "@stencil/store";

const {state, on, get, set} = createStore({});

export {on, get, set};
export default state;

