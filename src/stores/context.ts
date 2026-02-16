import { createStore } from "@stencil/store";

export interface ContextStore {
  locale: string
}

const { state, on, get, set } = createStore<ContextStore>({
  locale: 'en',
});

export { on, get, set };
export default state;
