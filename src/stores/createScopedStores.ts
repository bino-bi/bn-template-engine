/**
 * Factory that creates a fresh set of all 9 `@stencil/store` instances.
 *
 * Called once per `<bn-context>` element so that each context owns isolated
 * reactive state. The returned object satisfies the {@link ScopedStores} interface.
 *
 * @module stores/createScopedStores
 */
import { createStore } from "@stencil/store";
import { SYSTEM_STYLE_DEFAULTS, Style } from "./componentStyles";
import { SYSTEM_I18N_DEFAULTS } from "./internationalization";
import { SYSTEM_RULESET_DEFAULTS, RuleSetConfig } from "./ruleSets";
import { ContextStore } from "./context";
import { DatasetMeta } from "../utils/model/DatasetMeta";
import { createScopedDb } from "../context/scopedDb";

export function createScopedStores() {
  const db = createScopedDb();
  const datasetsMeta = createStore<Record<string, DatasetMeta>>({} as Record<string, DatasetMeta>);
  const componentStyles = createStore<Record<string, Style>>({
    _system: SYSTEM_STYLE_DEFAULTS,
  });
  const internationalization = createStore<Record<string, unknown>>({ ...SYSTEM_I18N_DEFAULTS });
  const assets = createStore<Record<string, string>>({} as Record<string, string>);
  const context = createStore<ContextStore>({ locale: "en" });
  const scalingGroups = createStore<Record<string, number>>({});
  const ruleSets = createStore<Record<string, RuleSetConfig>>({
    _system: SYSTEM_RULESET_DEFAULTS,
  });

  return {
    db,
    datasetsMeta,
    componentStyles,
    internationalization,
    assets,
    context,
    scalingGroups,
    ruleSets,
  };
}
