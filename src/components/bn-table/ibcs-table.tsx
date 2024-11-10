import { Component, h, Host, Prop } from "@stencil/core";

import { OrderDirection, TableType } from "./utils/model";

import { TableRow } from "./utils/elements";
import { Table } from "./utils/Table";

import { TableComponentConfig, TableComponentConfigAdapter } from "./utils/model/TableComponentConfig";
import { TableDrillGroup, TableDrillGroupAdapter } from "./utils/model/TableDrillGroup";
import { TableDataRow, TableDataRowAdapter } from "./utils/model/TableDataRow";
import { DataFormat, I18nMode, MeasureType, TableCategoryWidth } from "../../utils/constants";

import { AdapterUtils } from "../../utils/helper/AdapterUtils";
import { StringAdapter } from "../../utils/helper/StringAdapter";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../utils/model/DataFormatDigits";
import { Order, OrderAdapter } from "../../utils/model/Order";


@Component({
  tag: "ibcs-table",
  styleUrl: "ibcs-table.scss",
})
export class IbcsTable {

  @Prop()
  data: TableDataRow[] = [];

  @Prop()
  tableTitle: string = "SUM_TOTAL";

  @Prop()
  scenarios: string[] = [];

  @Prop()
  scenariosDataFormat: DataFormat = DataFormat.DECIMAL;

  @Prop()
  grouped?: boolean = false;

  @Prop()
  limit: number = 0;

  @Prop()
  showGroupTitle: boolean = true;

  @Prop()
  thereof: TableDrillGroup[] = [];

  @Prop()
  partof: TableDrillGroup[] = [];

  @Prop()
  order: Order = {
    hierarchy: [],
    direction: OrderDirection.ASC,
  };

  @Prop()
  categorythereof: Map<string, any> = new Map();

  @Prop()
  type: TableType = TableType.LIST;

  @Prop()
  categoryWidth: TableCategoryWidth = TableCategoryWidth.INF;

  @Prop()
  dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

  @Prop({ mutable: true })
  i18n: Map<string, string> = new Map();

  @Prop({ attribute: "i18n-mode" })
  i18nMode: I18nMode = I18nMode.ALL;

  @Prop()
  measureScale: string = "_";

  @Prop()
  measureUnit: string = "";

  @Prop()
  showMeasureScale: boolean = true;

  @Prop()
  measureType: MeasureType = MeasureType.VOLUME;

  @Prop()
  filter: string = "";
  
  private table: Table | undefined;
  private componentDataFormatDigits: DataFormatDigits = new DataFormatDigits();

  constructor() {

  }

  render() {

    const helper = () => {
      if (this.table == undefined) {
        return;
      }

      if (this.table.hasNoData()) {
        const errorMsg: string = this.i18n.get("NO_DATA") || "==No Data==";
        return (<p class="warning">{errorMsg}</p>);
      }

      return (<table>
        <thead>
          {this.table.getHeader().map((row: TableRow) =>
            <tr class={row.cssStyle}>{row.getCells().map((cell) => <th colSpan={cell.colSpan}
              class={cell.cssStyle}>{cell.getAsHeaderList().map((line, i, arr) =>
                <span>{i === (arr.length - 1) ? <span class={line === " "? "table-footer": ""}>{line}{cell.drawPrefix()} </span> : <span>{line}{cell.drawPrefix()}<br /></span>}</span>)}</th>)}</tr>,
          )}
        </thead>
        <tbody>
          {this.table.getBody().map((row: TableRow) =>
            <tr class={row.cssStyle}>{row?.getCells().map((cell) => <td colSpan={cell.colSpan} class={cell.cssStyle + " " + cell.type}>
              {cell.prefix != null ?
                <span
                  class={cell.cssStyle + " " + cell.prefixStyle}>{cell.drawPrefix()}</span> : ''}{cell.draw(this.componentDataFormatDigits)}</td>)}</tr>,
          )}
        </tbody>
      </table>)
    }


    return <Host>{helper()}</Host>
  }


  componentWillRender() {
    const config: TableComponentConfig = this.prepareConfig();
    const data: TableDataRow[] = this.prepareData();

    this.componentDataFormatDigits = new DataFormatDigitsAdapter().adapt(this.dataFormatDigits);
    this.table = new Table(new IBCSRuleSet(), data, config);
    this.table.setI18n(this.i18n);
  }



  private prepareConfig(): TableComponentConfig {
    let config = new TableComponentConfigAdapter(new TableDrillGroupAdapter(), new StringAdapter(), new OrderAdapter(new StringAdapter()), this.data).adapt({
      title: this.tableTitle,
      scenarios: this.scenarios,
      scenariosUnitType: this.scenariosDataFormat,
      grouped: this.grouped,
      showGroupTitle: this.showGroupTitle,
      thereOf: this.thereof,
      partOf: this.partof,
      categoryThereOf: this.categorythereof,
      order: this.order,
      type: this.type,
      limit: this.limit,
      i18n: this.i18nMode,
      categoryWidth: this.categoryWidth,
      measureScale: this.measureScale,
      measureUnit: this.measureUnit,
      measureType: this.measureType,
      showMeasureScale: this.showMeasureScale,
      filter: this.filter
    });

    return config;
  }

  private prepareData(): TableDataRow[] {
    return AdapterUtils.adaptArray(this.data, new TableDataRowAdapter());
  }
}

