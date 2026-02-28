/**
 * Reactive store for reusable binary assets, keyed by asset name.
 *
 * Values are data-URI strings (e.g. `data:image/png;base64,...`) that
 * components can reference for inline images, icons, or other embedded
 * resources without additional network requests.
 *
 * @module stores/assets
 */
import { createStore } from "@stencil/store";

const { state, on, get, set } = createStore({} as Record<string, string>);

export { on, get, set };
export default state;
