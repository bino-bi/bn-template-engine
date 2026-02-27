import { createStore } from "@stencil/store";

const { state, on, get, set } = createStore({} as Record<string, string>);

export { on, get, set };
export default state;
