import { forceUpdate, getElement } from "@stencil/core";
import { Style } from "../stores/componentStyles";
import { getStores, clearStoresCache, ScopedStores } from "../context/context-protocol";
import { runIfExisits } from "./utils";
import { merge } from "@corex/deepmerge";

/**
 * Mixin that provides themed styling to a Stencil component using a
 * three-layer merge strategy.
 *
 * The effective style is computed by deep-merging three layers in order:
 * 1. `_system`  -- built-in defaults (lowest priority)
 * 2. `_default` -- user-defined global overrides
 * 3. The style named by the `selectedStyle` prop of the component (highest priority)
 *
 * The prop is read again each time the style is used, and the store
 * subscription reacts to updates in the componentStyles store, triggering a
 * re-merge and forced re-render on changes.
 *
 * @param component - The Stencil component instance
 * @returns A query function `componentStyle(<selector>)` that provides type-safe
 *          access to the merged style object, e.g. `componentStyle(s => s.table.headerBg)`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withComponentStyle = (component: any) => {
  let subscription: () => void;
  let stores: ScopedStores;

  let selectedStyle: string;
  let style: Style;

  const updateStyle = () => {
    const state = stores.componentStyles.state;
    // Arrays overwrite instead of concatenating: ordered color lists like
    // seriesColors/stackColors must be replaced wholesale by an override.
    style = merge(
      [state["_system"] || ({} as Style), state["_default"] || ({} as Style), state[selectedStyle] || ({} as Style)],
      { arrayMergeType: "overwrite" },
    );
  };

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    stores = getStores(element);
    style = stores.componentStyles.state["_system"];

    selectedStyle = component.selectedStyle;

    updateStyle();

    subscription = stores.componentStyles.on("set", (key) => {
      if (key === selectedStyle) {
        selectedStyle = component.selectedStyle;
        updateStyle();
        forceUpdate(getElement(component));
      }
    });

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    runIfExisits(subscription);
    clearStoresCache(getElement(component));
    runIfExisits(disconnectedCallback, component);
  };

  const componentStyle = <T>(q: ($style: Style) => T): T => {
    // A change of the prop renders the component, and the style is read while it renders.
    // So the prop is compared here: no observer, and a property write counts like an attribute.
    if (stores !== undefined && component.selectedStyle !== selectedStyle) {
      selectedStyle = component.selectedStyle;
      updateStyle();
    }
    return q(style);
  };

  return componentStyle;
};

export default withComponentStyle;
