import { on as onSet, get as getSet } from '../stores/datasets';
import { on as onSource, get as getSource } from '../stores/datasources';
import { startsWith, partition } from 'ramda';

import { runIfExisits } from "./utils";
import { getElement } from "@stencil/core";

const withDataset = (component: any, onUpdate: (name: string, data: any) => void) => {
  let subscriptionSet: () => void;
  let subscriptionSource: () => void;
  let datasets: string[] = [];
  let datasources: string[] = [];

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'datasets') {
        [datasources, datasets] = (partition(startsWith("$"), getElement(component).getAttribute('datasets').split(",")));
        datasets.forEach(name => {
          // @ts-ignore
          onUpdate(name, getSet(name));
        })
        datasources.forEach(name => {
          // @ts-ignore
          onUpdate(name, getSource(name.substring(1)));
        })
      }
    });
  });

  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    const element = getElement(component);
    [datasources, datasets] = (partition(startsWith("$"), (element.getAttribute('datasets') || "").split(",")));
    datasets.forEach(name => {
      // @ts-ignore
      onUpdate(name, getSet(name));
    })
    datasources.forEach(name => {
      // @ts-ignore
      onUpdate(name, getSource(name.substring(1)));
    })

    observer.observe(element, { attributes: true, attributeFilter: ['datasets'] });

    subscriptionSet = onSet("set", (key, newVlaue) => {
      if (datasets.includes(key)) {
        onUpdate(key, newVlaue);
      }
    })

    subscriptionSource = onSource("set", (key, newVlaue) => {
      if (datasources.includes("$" + key)) {
        onUpdate("$" + key, newVlaue);
      }
    })


    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component['disconnectedCallback'];
  component['disconnectedCallback'] = () => {
    observer.disconnect();
    runIfExisits(subscriptionSet);
    runIfExisits(subscriptionSource);
    runIfExisits(disconnectedCallback, component);
  };

  return (names: string[]) => {
    datasets = names;
    names.forEach(name => {
      // @ts-ignore
      onUpdate(name, getSet(name));
    })
  }
}

export default withDataset;
