import { Component, Element, Fragment, h, Method } from "@stencil/core";
import { BN_INTERNATIONALIZATION_KEYS } from "../../stores/internationalization";
import { getStores, ScopedStores } from "../../context/context-protocol";

/**
 * Headless helper component for editor integration.
 *
 * Exposes public `@Method()` APIs so an external editor can query
 * i18n keys and distinct data values from datasources/datasets at
 * design time (e.g. for autocompletion or property pickers).
 */
@Component({
  tag: "editor-companion",
  styleUrl: "editor-companion.scss",
})
export class EditorCompanion {
  // @ts-ignore - Required by mixins
  @Element() private element: HTMLElement;

  private stores: ScopedStores;
  private distinctCache = new Map<string, unknown[]>();

  connectedCallback() {
    this.stores = getStores(this.element);
  }

  @Method()
  internationalizationKeys(): Promise<string[]> {
    return Promise.resolve(BN_INTERNATIONALIZATION_KEYS);
  }

  @Method()
  getDistinctFromDataSource(dataSourceName: string, key: string): Promise<unknown[]> {
    const cacheKey = `datasource:${dataSourceName}:${key}`;
    if (this.distinctCache.has(cacheKey)) {
      return Promise.resolve(this.distinctCache.get(cacheKey));
    }
    // @ts-ignore
    const result = this.distinct(this.stores.datasources.get(dataSourceName) || [], key);
    this.distinctCache.set(cacheKey, result);
    return Promise.resolve(result);
  }

  @Method()
  getDistinctFromDataset(datasetName: string, key: string): Promise<unknown[]> {
    const cacheKey = `dataset:${datasetName}:${key}`;
    if (this.distinctCache.has(cacheKey)) {
      return Promise.resolve(this.distinctCache.get(cacheKey));
    }
    // @ts-ignore
    const result = this.distinct(this.stores.datasets.get(datasetName) || [], key);
    this.distinctCache.set(cacheKey, result);
    return Promise.resolve(result);
  }

  render() {
    return <Fragment></Fragment>;
  }

  private distinct(data: object[], key: string): unknown[] {
    return [...new Set(data.map((d) => d[key]))].filter((v) => v !== null && v !== undefined);
  }
}
