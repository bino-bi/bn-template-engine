import { Component, Fragment, Method, h } from "@stencil/core";
import { BN_INTERNATIONALIZATION_KEYS } from "../../stores/internationalization";
import { get as getDataset } from "../../stores/datasets";
import { get as getDataSource } from "../../stores/datasources";

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
  @Method()
  internationalizationKeys(): Promise<string[]> {
    return Promise.resolve(BN_INTERNATIONALIZATION_KEYS);
  }

  @Method()
  getDistinctFromDataSource(dataSourceName: string, key: string): Promise<unknown[]> {
    // TODO: add caching
    // @ts-ignore
    return Promise.resolve(this.distinct(getDataSource(dataSourceName) || [], key));
  }

  @Method()
  getDistinctFromDataset(datasetName: string, key: string): Promise<unknown[]> {
    // TODO: add caching
    // @ts-ignore
    return Promise.resolve(this.distinct(getDataset(datasetName) || [], key));
  }

  render() {
    return <Fragment></Fragment>;
  }

  private distinct(data: object[], key: string): unknown[] {
    return [...new Set(data.map((d) => d[key]))].filter(Boolean); // TODO: refine filter ("", 0 also removed
  }
}
