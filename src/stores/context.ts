/**
 * Reactive store for global application context shared across all components.
 *
 * Currently holds the active locale, which drives the `withTranslation` mixin
 * and the internationalization store to resolve the correct language bundle.
 *
 * @module stores/context
 */
import { createStore } from "@stencil/store";

/** Global context properties available to every component. */
export interface ContextStore {
  locale: string;
}

const { state, on, get, set } = createStore<ContextStore>({
  locale: "en",
});

export { on, get, set };
export default state;
