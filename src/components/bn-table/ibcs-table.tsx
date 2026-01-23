import { Component, Element, h, Host, Prop } from "@stencil/core";

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
import { CellBarChart, CellBarChartStyles } from "./utils/elements/CellBarChart";
import { Cell } from "./utils/elements/Cell";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";


@Component({
  tag: "ibcs-table",
  styleUrl: "ibcs-table.scss",
  shadow: true
})
export class IbcsTable {
  // @ts-ignore - Required by withComponentStyle mixin
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;

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

  @Prop()
  barColumns: string[] = [];

  @Prop()
  unitScaling: number = 0.01;

  @Prop()
  percentageScaling: number = 0.5;

  private table: Table | undefined;
  private componentDataFormatDigits: DataFormatDigits = new DataFormatDigits();
  private barChartStyles: CellBarChartStyles;

  constructor() {
    this.componentStyle = withComponentStyle(this);
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
            <tr class={row.cssStyle}>{row?.getCells().map((cell: Cell) => <td colSpan={cell.colSpan} class={cell.cssStyle + " " + cell.type}>
              {cell.prefix != null ?
                <span
                  class={cell.cssStyle + " " + cell.prefixStyle}>{cell.drawPrefix()}</span> : ''}
              {cell.isBarChart && cell.columnStats ? (
                <CellBarChart
                  value={cell.value as number}
                  scenario={cell.key}
                  columnStats={cell.columnStats}
                  height={18}
                  isRelative={cell.key.startsWith('dr')}
                  isPositiveGood={cell.key.endsWith('_pos')}
                  measureScale={cell.measureScale}
                  styles={this.barChartStyles}
                />
              ) : (
                cell.draw(this.componentDataFormatDigits)
              )}</td>)}</tr>,
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
    this.barChartStyles = this.prepareBarChartStyles();
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
      filter: this.filter,
      barColumns: this.barColumns
    });

    return config;
  }

  private prepareData(): TableDataRow[] {
    return AdapterUtils.adaptArray(this.data, new TableDataRowAdapter());
  }

  /**
   * Prepares bar chart styles from componentStyle store.
   * Uses the same variance styles as bn-chart-time for consistency.
   * Supports fillpattern for different visual treatments (solid, hatched, outlined).
   * Scenario styles (ac, pp, fc, pl) use barStyles for IBCS-compliant grayscale coloring.
   */
  private prepareBarChartStyles(): CellBarChartStyles {
    return this.componentStyle($ => {
      const varianceStyles = $["bn-chart-time"]?.["varianceStyles"];
      const barStyles = $["bn-chart-time"]?.["barStyles"];

      // Default variance styles with fillpattern
      const defaultPos = { stroke: '#008f96', fill: '#008f96', fillpattern: 'solid' };
      const defaultNeg = { stroke: '#ff0000', fill: '#ff0000', fillpattern: 'solid' };
      const defaultNeu = { stroke: '#808080', fill: '#808080', fillpattern: 'outlined' };

      // Default scenario styles (IBCS grayscale)
      const defaultAc = { stroke: '#404040', fill: '#404040', fillpattern: 'solid' };
      const defaultPp = { stroke: '#A6A6A6', fill: '#A6A6A6', fillpattern: 'solid' };
      const defaultFc = { stroke: '#404040', fill: '#ffffff', fillpattern: 'hatched' };
      const defaultPl = { stroke: '#404040', fill: '#ffffff', fillpattern: 'outlined' };

      return {
        positive: {
          stroke: varianceStyles?.pos?.stroke || defaultPos.stroke,
          fill: varianceStyles?.pos?.fill || defaultPos.fill,
          fillpattern: (varianceStyles?.pos as any)?.fillpattern || defaultPos.fillpattern
        },
        negative: {
          stroke: varianceStyles?.neg?.stroke || defaultNeg.stroke,
          fill: varianceStyles?.neg?.fill || defaultNeg.fill,
          fillpattern: (varianceStyles?.neg as any)?.fillpattern || defaultNeg.fillpattern
        },
        neutral: {
          stroke: varianceStyles?.neu?.stroke || defaultNeu.stroke,
          fill: varianceStyles?.neu?.fill || defaultNeu.fill,
          fillpattern: (varianceStyles?.neu as any)?.fillpattern || defaultNeu.fillpattern
        },
        scenarios: {
          ac: {
            stroke: barStyles?.ac?.stroke || defaultAc.stroke,
            fill: barStyles?.ac?.fill || defaultAc.fill,
            fillpattern: (barStyles?.ac as any)?.fillpattern || defaultAc.fillpattern
          },
          pp: {
            stroke: barStyles?.pp?.stroke || defaultPp.stroke,
            fill: barStyles?.pp?.fill || defaultPp.fill,
            fillpattern: (barStyles?.pp as any)?.fillpattern || defaultPp.fillpattern
          },
          fc: {
            stroke: barStyles?.fc?.stroke || defaultFc.stroke,
            fill: barStyles?.fc?.fill || defaultFc.fill,
            fillpattern: (barStyles?.fc as any)?.fillpattern || defaultFc.fillpattern
          },
          pl: {
            stroke: barStyles?.pl?.stroke || defaultPl.stroke,
            fill: barStyles?.pl?.fill || defaultPl.fill,
            fillpattern: (barStyles?.pl as any)?.fillpattern || defaultPl.fillpattern
          }
        },
        fontColor: $["global"]?.["fontColor"] || '#000000',
        fontSize: ($["global"]?.["fontSizePx"] || 13.3333) * 0.85, // Slightly smaller for table cells
        fontFamily: $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
        unitScaling: this.unitScaling,
        percentageScaling: this.percentageScaling
      };
    });
  }
}

