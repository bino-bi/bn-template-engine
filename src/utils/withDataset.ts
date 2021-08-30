import {on, get} from '../stores/datasets';

import {runIfExisits} from "./utils";
import {HTMLStencilElement} from "@stencil/core/internal";
import {getElement} from "@stencil/core";

const withDataset = (component: any, onUpdate: (name: string, data: any) => void) => {
  let subscription: () => void;
  let datasets: string[] = [];

  const element: HTMLStencilElement = getElement(component);
  const connectedCallback = component['connectedCallback'];

  console.dir([element, connectedCallback])

  datasets = element.getAttribute('datasets').split(",");
  datasets.forEach(name => {
    // @ts-ignore
    onUpdate(name, get(name));
  })

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'datasets') {
        datasets = element.getAttribute('datasets').split(",");
      }
    });
  });

  component['connectedCallback'] = () => {
    observer.observe(element, {attributes: true, attributeFilter: ['datasets']});

    subscription = on("set", (key, newVlaue) => {
      if (datasets.includes(key)) {
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

  return (names: string[]) => {
    datasets = names;
    names.forEach(name => {
      // @ts-ignore
      onUpdate(name, get(name));
    })
  }
}

export default withDataset;
