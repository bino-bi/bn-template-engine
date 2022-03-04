import { on, get } from '../stores/datasources';
import { runIfExisits } from "./utils";
import { getElement } from "@stencil/core";

const withDatasource = (component: any, onUpdate: (name: string, data: any) => void) => {
  let subscription: () => void;
  let datasources: string[] = [];

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'datasources') {
        datasources = (getElement(component).getAttribute('datasources') || "").split(",");
        datasources.forEach(name => {
          // @ts-ignore
          onUpdate(name, get(name));
        })
      }
    });
  });

  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    const element = getElement(component);
    datasources = (element.getAttribute('datasources') || "").split(",");
    datasources.forEach(name => {
      // @ts-ignore
      onUpdate(name, get(name));
    })

    observer.observe(element, { attributes: true, attributeFilter: ['datasources'] });
    subscription = on("set", (key, newVlaue) => {
      if (datasources.includes(key)) {
        onUpdate(key, newVlaue);
      }
    })

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component['disconnectedCallback'];
  component['disconnectedCallback'] = () => {
    observer.disconnect();
    runIfExisits(subscription);
    runIfExisits(disconnectedCallback, component);
  };
}

export default withDatasource;
