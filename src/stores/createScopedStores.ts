/**
 * Factory that creates a fresh set of all 8 `@stencil/store` instances.
 *
 * Called once per `<bn-context>` element so that each context owns isolated
 * reactive state. The returned object satisfies the {@link ScopedStores} interface.
 *
 * @module stores/createScopedStores
 */
import { createStore } from "@stencil/store";
import { SYSTEM_STYLE_DEFAULTS, Style } from "./componentStyles";
import { SYSTEM_I18N_DEFAULTS } from "./internationalization";
import { ContextStore } from "./context";
import { DatasetMeta } from "../utils/model/DatasetMeta";

export function createScopedStores() {
  const datasources = createStore<Record<string, unknown>>({});
  const datasets = createStore<Record<string, unknown>>({});
  const datasetsMeta = createStore<Record<string, DatasetMeta>>({} as Record<string, DatasetMeta>);
  const componentStyles = createStore<Record<string, Style>>({
    _system: SYSTEM_STYLE_DEFAULTS,
  });
  const internationalization = createStore<Record<string, unknown>>({ ...SYSTEM_I18N_DEFAULTS });
  const assets = createStore<Record<string, string>>({} as Record<string, string>);
  const context = createStore<ContextStore>({ locale: "en" });
  const scalingGroups = createStore<Record<string, number>>({});

  return {
    datasources,
    datasets,
    datasetsMeta,
    componentStyles,
    internationalization,
    assets,
    context,
    scalingGroups,
  };
}
