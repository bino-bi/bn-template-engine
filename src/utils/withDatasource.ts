import { getStores, clearStoresCache, ScopedStores } from "../context/context-protocol";
import { runIfExisits } from "./utils";
import { getElement } from "@stencil/core";

/**
 * Mixin that subscribes a Stencil component to raw datasources.
 *
 * This is the simpler counterpart of {@link withDataset} -- it reads directly from
 * the shared alasql database via `stores.db.subscribe(name, ...)`. Primarily used
 * by `bn-dataset` itself to react to upstream datasource updates so it can re-fire
 * its own dataset notification.
 *
 * Watches the host element's `datasources` attribute via MutationObserver for
 * dynamic rebinding at runtime.
 *
 * @param component - The Stencil component instance
 * @param onUpdate - Callback invoked with `(name, data)` whenever a subscribed datasource changes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withDatasource = (component: any, onUpdate: (name: string, data: unknown) => void) => {
  let dbUnsubs: (() => void)[] = [];
  let datasources: string[] = [];
  let stores: ScopedStores;

  const deliver = (name: string) => {
    let rows: unknown;
    try {
      rows = stores.db.db.exec(`SELECT * FROM \`${name}\``);
    } catch (_e) {
      rows = [];
    }
    onUpdate(name, rows);
  };

  const rebind = () => {
    dbUnsubs.forEach((fn) => fn());
    dbUnsubs = [];
    datasources.forEach((name) => {
      if (!name) return;
      dbUnsubs.push(stores.db.subscribe(name, () => deliver(name)));
      deliver(name);
    });
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "datasources") {
        datasources = (getElement(component).getAttribute("datasources") || "").split(",");
        rebind();
      }
    });
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    stores = getStores(element);

    datasources = (element.getAttribute("datasources") || "").split(",");
    rebind();

    observer.observe(element, { attributes: true, attributeFilter: ["datasources"] });

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    dbUnsubs.forEach((fn) => fn());
    dbUnsubs = [];
    clearStoresCache(getElement(component));
    runIfExisits(disconnectedCallback, component);
  };
};

export default withDatasource;
