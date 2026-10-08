import { getStores, clearStoresCache, ScopedStores } from "../context/context-protocol";
import { DatasetMeta } from "./model/DatasetMeta";

import { runIfExisits } from "./utils";
import { getElement } from "@stencil/core";

/**
 * Splits an array into two groups based on a predicate.
 * Used to separate `$`-prefixed datasource refs from dataset refs.
 * @returns Tuple of [matches, nonMatches]
 */
const partition = <T>(predicate: (item: T) => boolean, arr: T[]): [T[], T[]] => {
  const matches: T[] = [];
  const nonMatches: T[] = [];
  for (const item of arr) {
    (predicate(item) ? matches : nonMatches).push(item);
  }
  return [matches, nonMatches];
};

const WARN_DATASOURCE_ID = "WARN_use_dataset";

/**
 * Emits a warning via the component's ErrorDispatcher when datasource refs
 * (`$name`) are used directly, nudging consumers toward bn-dataset wrappers
 * which provide query support and metadata.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const warnIfDatasource = (component: any, datasources: string[]) => {
  const errors = component.errors;
  if (!errors) return;
  if (datasources.length > 0) {
    const names = datasources.map((n) => n.substring(1)).join(", ");
    errors.addOrReplace({
      id: WARN_DATASOURCE_ID,
      type: "warning",
      message: `Using datasource(s) "${names}" directly. Prefer using a dataset (bn-dataset) for query support and metadata.`,
    });
  } else {
    errors.remove(WARN_DATASOURCE_ID);
  }
};

/**
 * Mixin that subscribes a Stencil component to one or more datasets/datasources.
 *
 * **Naming convention:** The `datasets` prop of the component accepts a comma-separated list of names.
 * Names prefixed with `$` (e.g. `$revenue`) read directly from the raw datasource tables;
 * unprefixed names read from datasets (registered as tables/views by `<bn-dataset>`).
 *
 * Data is sourced from the shared per-context alasql database; each subscribed
 * name is registered with `stores.db.subscribe(...)` and the rows are materialized
 * via `db.exec("SELECT * FROM <name>")` whenever the producer fires `notify(name)`.
 *
 * The prop reflects to the `datasets` attribute. The mixin watches that attribute with a
 * MutationObserver, so bindings follow a change of the attribute or the property.
 *
 * @param component - The Stencil component instance (must expose a host element via `@Element()`)
 * @param onUpdate - Callback invoked with `(name, data)` whenever a subscribed dataset or datasource changes
 * @param onMetaUpdate - Optional callback invoked with `(name, meta)` when DatasetMeta changes for a subscribed dataset
 * @returns A function to programmatically replace the list of subscribed dataset names
 */
const withDataset = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any,
  onUpdate: (name: string, data: unknown) => void,
  onMetaUpdate?: (name: string, meta: DatasetMeta) => void,
) => {
  let dbUnsubs: (() => void)[] = [];
  let subscriptionMeta: () => void;
  let datasets: string[] = [];
  let datasources: string[] = [];
  let stores: ScopedStores;

  // the prop, not the attribute: a property set before the first render is not reflected yet
  const names = (): string[] => (component.datasets || "").split(",");

  /** Materialize the current rows for a subscribed name via the shared db, then deliver. */
  const deliver = (name: string, isDatasource: boolean) => {
    const tableName = isDatasource ? name.substring(1) : name;
    let rows: unknown;
    try {
      rows = stores.db.db.exec(`SELECT * FROM \`${tableName}\``);
    } catch (_e) {
      // Table/view not registered yet (producer hasn't fired). Treat as empty.
      rows = [];
    }
    onUpdate(name, rows);
  };

  const deliverMeta = (name: string) => {
    if (onMetaUpdate) {
      // @ts-ignore
      const meta = stores.datasetsMeta.get(name);
      if (meta) onMetaUpdate(name, meta);
    }
  };

  /** Tear down current db subscriptions and re-subscribe based on `datasets` / `datasources`. */
  const rebind = () => {
    dbUnsubs.forEach((fn) => fn());
    dbUnsubs = [];

    datasets.forEach((name) => {
      if (!name) return;
      dbUnsubs.push(stores.db.subscribe(name, () => deliver(name, false)));
      deliver(name, false);
      deliverMeta(name);
    });
    datasources.forEach((ref) => {
      if (!ref) return;
      dbUnsubs.push(stores.db.subscribe(ref.substring(1), () => deliver(ref, true)));
      deliver(ref, true);
    });
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "datasets") {
        [datasources, datasets] = partition((s) => s.startsWith("$"), names());
        warnIfDatasource(component, datasources);
        rebind();
      }
    });
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    stores = getStores(element);

    [datasources, datasets] = partition((s) => s.startsWith("$"), names());
    warnIfDatasource(component, datasources);
    rebind();

    observer.observe(element, { attributes: true, attributeFilter: ["datasets"] });

    if (onMetaUpdate) {
      subscriptionMeta = stores.datasetsMeta.on("set", (key, newValue) => {
        if (datasets.includes(key as string)) {
          onMetaUpdate(key as string, newValue as DatasetMeta);
        }
      });
    }

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    dbUnsubs.forEach((fn) => fn());
    dbUnsubs = [];
    runIfExisits(subscriptionMeta);
    clearStoresCache(getElement(component));
    runIfExisits(disconnectedCallback, component);
  };

  return (names: string[]) => {
    datasets = names;
    rebind();
  };
};

export default withDataset;
