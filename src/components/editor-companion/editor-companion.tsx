import { Component, Fragment, Method, h } from "@stencil/core";
import { BN_INTERNATIONALIZATION_KEYS } from "../../stores/internationalization";
import { get as getDataset } from "../../stores/datasets";
import { get as getDataSource } from "../../stores/datasources";

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
  getDistinctFromDataSource(dataSourceName: string, key: string): Promise<any[]> {
    // TODO: add caching
    // @ts-ignore
    return Promise.resolve(this.distinct(getDataSource(dataSourceName) || [], key));
  }

  @Method()
  getDistinctFromDataset(datasetName: string, key: string): Promise<any[]> {
    // TODO: add caching
    // @ts-ignore
    return Promise.resolve(this.distinct(getDataset(datasetName) || [], key));
  }

  render() {
    return <Fragment></Fragment>;
  }

  private distinct(data: object[], key: string): any[] {
    return [...new Set(data.map((d) => d[key]))].filter(Boolean); // TODO: refine filter ("", 0 also removed
  }
}
