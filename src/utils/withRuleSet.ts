import { forceUpdate, getElement } from "@stencil/core";
import { RuleSetConfig } from "../stores/ruleSets";
import { getStores, clearStoresCache, ScopedStores } from "../context/context-protocol";
import { runIfExisits } from "./utils";
import { isInheritedValue, findLayoutAncestors, readInherited } from "./withInheritedProps";
import { merge } from "@corex/deepmerge";

/**
 * Mixin that provides the IBCS rule-set configuration to a Stencil component
 * using a three-layer merge strategy.
 *
 * The effective config is computed by deep-merging three layers in order:
 * 1. `_system`  -- built-in IBCS defaults (lowest priority)
 * 2. `_default` -- user-defined global overrides (a `<bn-ruleset>` without name)
 * 3. The value of the host element's `ruleset` attribute (highest priority)
 *
 * Unlike `withComponentStyle`, the store subscription also reacts to writes on
 * the `_default` layer, because a nameless `<bn-ruleset>` is the primary way
 * to adjust the rules context-wide.
 *
 * The `ruleset` attribute supports the `"inherited-closest"` /
 * `"inherited-page"` keywords from `withInheritedProps`: the actual name is
 * then read from the `ruleset` attribute of the nearest ancestor
 * `bn-layout-card` / `bn-layout-page` that sets one. Every ancestor on that
 * path is observed for changes.
 *
 * @param component - The Stencil component instance
 * @returns A function returning the merged {@link RuleSetConfig}. With `"user"` it returns the
 *   `_default` and the selected layer only.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withRuleSet = (component: any) => {
  let subscription: () => void;
  let stores: ScopedStores;

  let selectedRuleset: string;
  let config: RuleSetConfig;
  let userConfig: RuleSetConfig;

  let ancestorObserver: MutationObserver | null = null;

  const updateConfig = () => {
    const state = stores.ruleSets.state;
    // what a <bn-ruleset> set, without the built-in layer: only these names are labels
    userConfig = merge([state["_default"] || ({} as RuleSetConfig), state[selectedRuleset] || ({} as RuleSetConfig)]);
    config = merge([state["_system"] || ({} as RuleSetConfig), userConfig]);
  };

  const resolveRulesetName = () => {
    const element = getElement(component);
    const raw = element.getAttribute("ruleset");

    if (ancestorObserver) {
      ancestorObserver.disconnect();
      ancestorObserver = null;
    }

    if (raw && isInheritedValue(raw)) {
      const ancestors = findLayoutAncestors(element, raw);
      selectedRuleset = readInherited(ancestors, "ruleset");
      if (ancestors.length > 0) {
        ancestorObserver = new MutationObserver(() => {
          selectedRuleset = readInherited(ancestors, "ruleset");
          updateConfig();
          forceUpdate(component);
        });
        for (const ancestor of ancestors) {
          ancestorObserver.observe(ancestor, { attributes: true, attributeFilter: ["ruleset"] });
        }
      }
    } else {
      selectedRuleset = raw;
    }
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "ruleset") {
        resolveRulesetName();
        updateConfig();
        forceUpdate(component);
      }
    });
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    stores = getStores(element);
    config = stores.ruleSets.state["_system"];

    observer.observe(element, { attributes: true, attributeFilter: ["ruleset"] });

    resolveRulesetName();
    updateConfig();

    subscription = stores.ruleSets.on("set", (key) => {
      if (key === selectedRuleset || key === "_default") {
        resolveRulesetName();
        updateConfig();
        forceUpdate(getElement(component));
      }
    });

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    if (ancestorObserver) {
      ancestorObserver.disconnect();
      ancestorObserver = null;
    }
    runIfExisits(subscription);
    clearStoresCache(getElement(component));
    runIfExisits(disconnectedCallback, component);
  };

  const ruleSetConfig = (layers: "all" | "user" = "all"): RuleSetConfig => (layers === "user" ? userConfig : config);

  return ruleSetConfig;
};

export default withRuleSet;
