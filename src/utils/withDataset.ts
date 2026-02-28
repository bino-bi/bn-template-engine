import { on as onSet, get as getSet } from "../stores/datasets";
import { on as onSource, get as getSource } from "../stores/datasources";
import { on as onMeta, get as getMeta } from "../stores/datasetsMeta";
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
 * **Naming convention:** The `datasets` HTML attribute accepts a comma-separated list of names.
 * Names prefixed with `$` (e.g. `$revenue`) read directly from the raw datasources store;
 * unprefixed names read from the processed datasets store (populated by bn-dataset).
 *
 * The mixin installs a MutationObserver on the host element's `datasets` attribute so
 * bindings update automatically when the attribute is changed at runtime.
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
  let subscriptionSet: () => void;
  let subscriptionSource: () => void;
  let subscriptionMeta: () => void;
  let datasets: string[] = [];
  let datasources: string[] = [];

  const deliverMeta = (name: string) => {
    if (onMetaUpdate) {
      // @ts-ignore
      const meta = getMeta(name);
      if (meta) onMetaUpdate(name, meta);
    }
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "datasets") {
        [datasources, datasets] = partition(
          (s) => s.startsWith("$"),
          getElement(component).getAttribute("datasets").split(","),
        );
        warnIfDatasource(component, datasources);
        datasets.forEach((name) => {
          // @ts-ignore
          onUpdate(name, getSet(name));
          deliverMeta(name);
        });
        datasources.forEach((name) => {
          // @ts-ignore
          onUpdate(name, getSource(name.substring(1)));
        });
      }
    });
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    [datasources, datasets] = partition((s) => s.startsWith("$"), (element.getAttribute("datasets") || "").split(","));
    warnIfDatasource(component, datasources);
    datasets.forEach((name) => {
      // @ts-ignore
      onUpdate(name, getSet(name));
      deliverMeta(name);
    });
    datasources.forEach((name) => {
      // @ts-ignore
      onUpdate(name, getSource(name.substring(1)));
    });

    observer.observe(element, { attributes: true, attributeFilter: ["datasets"] });

    subscriptionSet = onSet("set", (key, newVlaue) => {
      if (datasets.includes(key)) {
        onUpdate(key, newVlaue);
      }
    });

    subscriptionSource = onSource("set", (key, newVlaue) => {
      if (datasources.includes("$" + key)) {
        onUpdate("$" + key, newVlaue);
      }
    });

    if (onMetaUpdate) {
      subscriptionMeta = onMeta("set", (key, newValue) => {
        if (datasets.includes(key)) {
          onMetaUpdate(key, newValue);
        }
      });
    }

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    runIfExisits(subscriptionSet);
    runIfExisits(subscriptionSource);
    runIfExisits(subscriptionMeta);
    runIfExisits(disconnectedCallback, component);
  };

  return (names: string[]) => {
    datasets = names;
    names.forEach((name) => {
      // @ts-ignore
      onUpdate(name, getSet(name));
      deliverMeta(name);
    });
  };
};

export default withDataset;
