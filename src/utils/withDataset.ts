import { on as onSet, get as getSet } from '../stores/datasets';
import { on as onSource, get as getSource } from '../stores/datasources';
import { on as onMeta, get as getMeta } from '../stores/datasetsMeta';
import { DatasetMeta } from './model/DatasetMeta';

import { runIfExisits } from "./utils";
import { getElement } from "@stencil/core";

const partition = <T>(predicate: (item: T) => boolean, arr: T[]): [T[], T[]] => {
  const matches: T[] = [];
  const nonMatches: T[] = [];
  for (const item of arr) {
    (predicate(item) ? matches : nonMatches).push(item);
  }
  return [matches, nonMatches];
};

const WARN_DATASOURCE_ID = 'WARN_use_dataset';

const warnIfDatasource = (component: any, datasources: string[]) => {
  const errors = component.errors;
  if (!errors) return;
  if (datasources.length > 0) {
    const names = datasources.map(n => n.substring(1)).join(', ');
    errors.addOrReplace({
      id: WARN_DATASOURCE_ID,
      type: 'warning',
      message: `Using datasource(s) "${names}" directly. Prefer using a dataset (bn-dataset) for query support and metadata.`
    });
  } else {
    errors.remove(WARN_DATASOURCE_ID);
  }
};

const withDataset = (component: any, onUpdate: (name: string, data: any) => void, onMetaUpdate?: (name: string, meta: DatasetMeta) => void) => {
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
      if (mutation.attributeName === 'datasets') {
        [datasources, datasets] = partition(s => s.startsWith("$"), getElement(component).getAttribute('datasets').split(","));
        warnIfDatasource(component, datasources);
        datasets.forEach(name => {
          // @ts-ignore
          onUpdate(name, getSet(name));
          deliverMeta(name);
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
    [datasources, datasets] = partition(s => s.startsWith("$"), (element.getAttribute('datasets') || "").split(","));
    warnIfDatasource(component, datasources);
    datasets.forEach(name => {
      // @ts-ignore
      onUpdate(name, getSet(name));
      deliverMeta(name);
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

    if (onMetaUpdate) {
      subscriptionMeta = onMeta("set", (key, newValue) => {
        if (datasets.includes(key)) {
          onMetaUpdate(key, newValue);
        }
      })
    }

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component['disconnectedCallback'];
  component['disconnectedCallback'] = () => {
    observer.disconnect();
    runIfExisits(subscriptionSet);
    runIfExisits(subscriptionSource);
    runIfExisits(subscriptionMeta);
    runIfExisits(disconnectedCallback, component);
  };

  return (names: string[]) => {
    datasets = names;
    names.forEach(name => {
      // @ts-ignore
      onUpdate(name, getSet(name));
      deliverMeta(name);
    })
  }
}

export default withDataset;
