import {Component, Prop, h, Host, Watch} from "@stencil/core";
import withDatasource from "../../utils/withDatasource";
import withBodyObserver from "../../utils/withBodyObserver";
import {set} from '../../stores/datasets';
import alasql from "alasql";

@Component({
  tag: 'bn-dataset',
  styleUrl: 'bn-dataset.css',
})
export class Dataset {
  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name!: string;

  @Prop() datasources: string = "";

  private query: string;
  private database: any;
  private latestResult: any;

  constructor() {
    // @ts-ignore
    this.database = new alasql.Database();
    withDatasource(this, (name, data) => {
      this.database.tables[name] = {data};
      this.executeQuery();
    });

    withBodyObserver(this, (data => {
      this.query = data;
      this.executeQuery();
    }));
  }

  executeQuery() {
    if (!!this.query && !!this.name) {
      const result = this.database.exec(this.query);
      if (this.latestResult !== result) {
        this.latestResult = result;
        // @ts-ignore
        set(this.name, result);
      }
    }
  }

  @Watch("name")
  nameUpdated() {
    this.executeQuery();
  }

  render() {
    return <Host/>
  }
}
