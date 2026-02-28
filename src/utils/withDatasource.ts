import { on, get } from "../stores/datasources";
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

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "datasources") {
        datasources = (getElement(component).getAttribute("datasources") || "").split(",");
        datasources.forEach((name) => {
          // @ts-ignore
          onUpdate(name, get(name));
        });
      }
    });
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    datasources = (element.getAttribute("datasources") || "").split(",");
    datasources.forEach((name) => {
      // @ts-ignore
      onUpdate(name, get(name));
    });

    observer.observe(element, { attributes: true, attributeFilter: ["datasources"] });
    subscription = on("set", (key, newVlaue) => {
      if (datasources.includes(key)) {
        onUpdate(key, newVlaue);
      }
    });

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    runIfExisits(subscription);
    runIfExisits(disconnectedCallback, component);
  };
};

export default withDatasource;
