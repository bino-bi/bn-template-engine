import {on, get} from '../stores/datasources';
import {runIfExisits} from "./utils";
import {HTMLStencilElement} from "@stencil/core/internal";
import {getElement} from "@stencil/core";

const withDatasource = (component: any, onUpdate: (name: string, data: any) => void) => {
  let subscription: () => void;
  let datasources: string[] = [];
  const connectedCallback = component['connectedCallback'];
  const element: HTMLStencilElement = getElement(component);

  datasources = element.getAttribute('datasources').split(",");
  datasources.forEach(name => {
    // @ts-ignore
    onUpdate(name, get(name));
  })

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'datasources') {
        datasources = element.getAttribute('datasources').split(",");
      }
    });
  });

  component['connectedCallback'] = () => {
    observer.observe(element, {attributes: true, attributeFilter: ['datasources']});
    subscription = on("set", (key, newVlaue) => {
      if (datasources.includes(key)) {
        onUpdate(key, newVlaue);
      }
    })

    runIfExisits(connectedCallback);
  };

  const disconnectedCallback = component['disconnectedCallback'];
  component['disconnectedCallback'] = () => {
    observer.disconnect();
    runIfExisits(subscription);
    runIfExisits(disconnectedCallback);
  };
}

export default withDatasource;
