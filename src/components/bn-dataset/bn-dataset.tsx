import { Component, Prop, h, Host, Watch } from "@stencil/core";
import withDatasource from "../../utils/withDatasource";
import withBodyObserver from "../../utils/withBodyObserver";
import { set } from '../../stores/datasets';
import { set as setMeta } from '../../stores/datasetsMeta';
import { calculateDatasetMeta } from '../../utils/datasetMetaCalculator';
import alasql from "alasql";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: 'bn-dataset',
  styleUrl: 'bn-dataset.css',
})
export class Dataset {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    // @ts-ignore
    this.database = new alasql.Database();
    withDatasource(this, (name, data) => {
      this.database.tables[name] = { data };
      this.executeQuery();
    });

    withBodyObserver(this, (data => {
      this.query = data;
      this.executeQuery();
    }));
  }
  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name!: string;

  /**
   * Commaseperated list of datasourcees
   * <br /><br />
   *  example: <br />
   *  ```source1,source2```
   *
   */
  @Prop() datasources: string = "";

  @Prop() static: boolean = false;

  private query: string;
  private database: any;
  private latestResult: any;

  executeQuery() {
    if (!!this.query && !!this.name) {
      let result: any;
      if (this.static) {
        try {
          result = JSON.parse(this.query);
        } catch (e) {
          console.error("Failed to parse static dataset", e);
          result = [];
        }
      } else {
        result = this.database.exec(this.query);
      }
      if (this.latestResult !== result) {
        this.latestResult = result;
        // @ts-ignore
        set(this.name, result);
        // @ts-ignore
        setMeta(this.name, calculateDatasetMeta(result));
      }
    }
  }

  @Watch("name")
  nameUpdated() {
    this.executeQuery();
  }

  render() {
    return <Host />
  }
}
