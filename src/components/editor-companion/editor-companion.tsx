import { Component, Element, Fragment, Method, h } from "@stencil/core";
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

  connectedCallback() {
    this.stores = getStores(this.element);
  }

  @Method()
  internationalizationKeys(): Promise<string[]> {
    return Promise.resolve(BN_INTERNATIONALIZATION_KEYS);
  }

  @Method()
  getDistinctFromDataSource(dataSourceName: string, key: string): Promise<unknown[]> {
    // TODO: add caching
    // @ts-ignore
    return Promise.resolve(this.distinct(this.stores.datasources.get(dataSourceName) || [], key));
  }

  @Method()
  getDistinctFromDataset(datasetName: string, key: string): Promise<unknown[]> {
    // TODO: add caching
    // @ts-ignore
    return Promise.resolve(this.distinct(this.stores.datasets.get(datasetName) || [], key));
  }

  render() {
    return <Fragment></Fragment>;
  }

  private distinct(data: object[], key: string): unknown[] {
    return [...new Set(data.map((d) => d[key]))].filter(Boolean); // TODO: refine filter ("", 0 also removed
  }
}
