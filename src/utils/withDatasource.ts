import { getStores, clearStoresCache, ScopedStores } from "../context/context-protocol";
import { runIfExisits } from "./utils";
import { getElement } from "@stencil/core";

/**
 * Mixin that subscribes a Stencil component to raw datasources.
 *
 * This is the simpler counterpart of {@link withDataset} -- it reads directly from
 * the datasources store without going through bn-dataset query processing.
 * Primarily used by bn-dataset itself, which needs access to raw data before
 * producing a processed dataset.
 *
 * Watches the host element's `datasources` attribute via MutationObserver for
 * dynamic rebinding at runtime.
 *
 * @param component - The Stencil component instance
 * @param onUpdate - Callback invoked with `(name, data)` whenever a subscribed datasource changes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withDatasource = (component: any, onUpdate: (name: string, data: unknown) => void) => {
  let subscription: () => void;
  let datasources: string[] = [];
  let stores: ScopedStores;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "datasources") {
        datasources = (getElement(component).getAttribute("datasources") || "").split(",");
        datasources.forEach((name) => {
          // @ts-ignore
          onUpdate(name, stores.datasources.get(name));
        });
      }
    });
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    stores = getStores(element);

    datasources = (element.getAttribute("datasources") || "").split(",");
    datasources.forEach((name) => {
      // @ts-ignore
      onUpdate(name, stores.datasources.get(name));
    });

    observer.observe(element, { attributes: true, attributeFilter: ["datasources"] });
    subscription = stores.datasources.on("set", (key, newVlaue) => {
      if (datasources.includes(key as string)) {
        onUpdate(key as string, newVlaue);
      }
    });

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    runIfExisits(subscription);
    clearStoresCache(getElement(component));
    runIfExisits(disconnectedCallback, component);
  };
};

export default withDatasource;
