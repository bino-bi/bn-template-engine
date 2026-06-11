import { Component, Element, h, Host, Prop } from "@stencil/core";

import { OrderDirection, TableRowType, TableType } from "./utils/model";

import { TableRow } from "./utils/elements";
import { Table } from "./utils/Table";

import { TableComponentConfig, TableComponentConfigAdapter } from "./utils/model/TableComponentConfig";
import { TableDrillGroup, TableDrillGroupAdapter } from "./utils/model/TableDrillGroup";
import { TableAttribute } from "./utils/model/TableAttribute";
import { DataFormat, I18nMode, MeasureType, TableCategoryWidth } from "../../utils/constants";

import { StringAdapter } from "../../utils/helper/StringAdapter";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../utils/model/DataFormatDigits";
import { Order, OrderAdapter } from "../../utils/model/Order";
import { CellBarChart, CellBarChartStyles } from "./utils/elements/CellBarChart";
import { Cell } from "./utils/elements/Cell";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";
import { getStores, ScopedStores } from "../../context/context-protocol";

/**
 * Internal rendering engine for `bn-table`.
 *
 * Receives pre-validated, typed props from the outer `bn-table` wrapper and
 * builds the IBCS-compliant HTML table — including header rows, scenario
 * columns, variance columns (with optional inline bar/pin charts), thereof/
 * partof drill-down rows, and grouped row sections. This component should
 * not be used directly; use `bn-table` instead.
 */
@Component({
  tag: "ibcs-table",
  styleUrl: "ibcs-table.scss",
  shadow: true,
})
export class IbcsTable {
  // @ts-ignore - Required by withComponentStyle mixin
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;

  /**
   * Name of the dataset (a table or view in the shared alasql database). The
   * inner `Table` helper queries it directly — no array copy.
   */
  @Prop()
  tableName: string = "";

  /**
   * Bumped by the outer `bn-table` whenever the dataset's data changes. Triggers
   * a re-render via Stencil's prop-change detection.
   */
  @Prop()
  dataVersion: number = 0;

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
  categorythereof: Map<string, Record<string, unknown>[]> = new Map();

  @Prop()
  attributeColumns: TableAttribute[] = [];

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
  barColumnMaxWidth: number = 30;

  @Prop()
  unitScaling: number = 0.01;

  @Prop()
  percentageScaling: number = 0.5;

  @Prop()
  scaleFactor: number = 1;

  private table: Table | undefined;
  private componentDataFormatDigits: DataFormatDigits = new DataFormatDigits();
  private barChartStyles: CellBarChartStyles;
  private stores: ScopedStores | undefined;

  constructor() {
    this.componentStyle = withComponentStyle(this);
  }

  render() {
    const helper = () => {
      if (this.table === undefined) {
        return;
      }

      if (this.table.hasNoData()) {
        const errorMsg: string = this.i18n.get("NO_DATA") || "==No Data==";
        return <p class="warning">{errorMsg}</p>;
      }

      return (
        <table>
          <thead>
            {this.table.getHeader().map((row: TableRow) => (
              <tr class={row.cssStyle}>
                {row.getCells().map((cell) => (
                  <th colSpan={cell.colSpan} class={cell.cssStyle}>
                    {cell.getAsHeaderList().map((line, i, arr) => (
                      <span>
                        {i === arr.length - 1 ? (
                          <span class={line === " " ? "table-footer" : ""}>
                            {line}
                            {cell.drawPrefix()}{" "}
                          </span>
                        ) : (
                          <span>
                            {line}
                            {cell.drawPrefix()}
                            <br />
                          </span>
                        )}
                      </span>
                    ))}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {this.table.getBody().map((row: TableRow) => (
              <tr class={row.cssStyle}>
                {row?.getCells().map((cell: Cell) => (
                  <td colSpan={cell.colSpan} class={cell.type ? `${cell.cssStyle} ${cell.type}` : cell.cssStyle}>
                    {cell.prefix != null ? (
                      <span class={cell.cssStyle + " " + cell.prefixStyle}>{cell.drawPrefix()}</span>
                    ) : (
                      ""
                    )}
                    {cell.isBarChart && cell.columnStats && row.type !== TableRowType.SUM ? (
                      <CellBarChart
                        value={cell.value as number}
                        scenario={cell.key}
                        columnStats={cell.columnStats}
                        height={18 * this.scaleFactor}
                        isRelative={cell.key.startsWith("dr")}
                        isPositiveGood={cell.key.endsWith("_pos")}
                        measureScale={cell.measureScale}
                        maxBarWidth={this.barColumnMaxWidth}
                        styles={this.barChartStyles}
                      />
                    ) : (
                      cell.draw(this.componentDataFormatDigits)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    };

    return <Host>{helper()}</Host>;
  }

  componentWillRender() {
    if (!this.stores) this.stores = getStores(this.element);
    const db = this.stores.db.db;

    const config: TableComponentConfig = this.prepareConfig(db);

    this.componentDataFormatDigits = new DataFormatDigitsAdapter().adapt(
      this.dataFormatDigits as unknown as Record<string, unknown>,
    );
    this.table = new Table(new IBCSRuleSet(), db, this.tableName, config);
    this.table.setI18n(this.i18n);
    this.barChartStyles = this.prepareBarChartStyles();
  }

  private prepareConfig(db: import("../../context/scopedDb").AlaSQLDatabase): TableComponentConfig {
    const fromExpr = this.tableName
      ? this.filter && this.filter.length > 0
        ? `(SELECT * FROM \`${this.tableName}\` WHERE ${this.filter}) AS __src`
        : `\`${this.tableName}\``
      : "";
    const config = new TableComponentConfigAdapter(
      new TableDrillGroupAdapter(),
      new StringAdapter(),
      new OrderAdapter(new StringAdapter()),
      db,
      fromExpr,
    ).adapt({
      title: this.tableTitle,
      scenarios: this.scenarios,
      scenariosUnitType: this.scenariosDataFormat,
      grouped: this.grouped,
      showGroupTitle: this.showGroupTitle,
      thereOf: this.thereof,
      partOf: this.partof,
      categoryThereOf: this.categorythereof,
      attributes: this.attributeColumns,
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
      barColumns: this.barColumns,
    });

    return config;
  }

  /**
   * Prepares bar chart styles from componentStyle store.
   * Uses the same variance styles as bn-chart-time for consistency.
   * Supports fillpattern for different visual treatments (solid, hatched, outlined).
   * Scenario styles (ac, pp, fc, pl) use barStyles for IBCS-compliant grayscale coloring.
   */
  private prepareBarChartStyles(): CellBarChartStyles {
    return this.componentStyle(($) => {
      const varianceStyles = $["bn-chart-time"]?.["varianceStyles"];
      const barStyles = $["bn-chart-time"]?.["barStyles"];

      // Default variance styles with fillpattern
      const defaultPos = { stroke: "#008f96", fill: "#008f96", fillpattern: "solid" };
      const defaultNeg = { stroke: "#ff0000", fill: "#ff0000", fillpattern: "solid" };
      const defaultNeu = { stroke: "#808080", fill: "#808080", fillpattern: "outlined" };

      // Default scenario styles (IBCS grayscale)
      const defaultAc = { stroke: "#404040", fill: "#404040", fillpattern: "solid" };
      const defaultPp = { stroke: "#A6A6A6", fill: "#A6A6A6", fillpattern: "solid" };
      const defaultFc = { stroke: "#404040", fill: "#ffffff", fillpattern: "hatched" };
      const defaultPl = { stroke: "#404040", fill: "#ffffff", fillpattern: "outlined" };

      /* eslint-disable @typescript-eslint/no-explicit-any */
      return {
        positive: {
          stroke: varianceStyles?.pos?.stroke || defaultPos.stroke,
          fill: varianceStyles?.pos?.fill || defaultPos.fill,
          fillpattern: (varianceStyles?.pos as any)?.fillpattern || defaultPos.fillpattern,
        },
        negative: {
          stroke: varianceStyles?.neg?.stroke || defaultNeg.stroke,
          fill: varianceStyles?.neg?.fill || defaultNeg.fill,
          fillpattern: (varianceStyles?.neg as any)?.fillpattern || defaultNeg.fillpattern,
        },
        neutral: {
          stroke: varianceStyles?.neu?.stroke || defaultNeu.stroke,
          fill: varianceStyles?.neu?.fill || defaultNeu.fill,
          fillpattern: (varianceStyles?.neu as any)?.fillpattern || defaultNeu.fillpattern,
        },
        scenarios: {
          ac: {
            stroke: barStyles?.ac?.stroke || defaultAc.stroke,
            fill: barStyles?.ac?.fill || defaultAc.fill,
            fillpattern: (barStyles?.ac as any)?.fillpattern || defaultAc.fillpattern,
          },
          pp: {
            stroke: barStyles?.pp?.stroke || defaultPp.stroke,
            fill: barStyles?.pp?.fill || defaultPp.fill,
            fillpattern: (barStyles?.pp as any)?.fillpattern || defaultPp.fillpattern,
          },
          fc: {
            stroke: barStyles?.fc?.stroke || defaultFc.stroke,
            fill: barStyles?.fc?.fill || defaultFc.fill,
            fillpattern: (barStyles?.fc as any)?.fillpattern || defaultFc.fillpattern,
          },
          pl: {
            stroke: barStyles?.pl?.stroke || defaultPl.stroke,
            fill: barStyles?.pl?.fill || defaultPl.fill,
            fillpattern: (barStyles?.pl as any)?.fillpattern || defaultPl.fillpattern,
          },
        },
        /* eslint-enable @typescript-eslint/no-explicit-any */
        fontColor: $["global"]?.["fontColor"] || "#000000",
        fontSize: ($["global"]?.["fontSizePx"] || 13.3333) * 0.85 * this.scaleFactor,
        fontFamily: $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
        unitScaling: this.unitScaling > 0 ? this.unitScaling : this.autoUnitScaling(),
        percentageScaling: this.percentageScaling > 0 ? this.percentageScaling : this.autoPercentageScaling(),
        scaleFactor: this.scaleFactor,
      };
    });
  }

  /**
   * Auto-calculate unitScaling so the largest absolute variance bar
   * fills ~80% of the bar column width.
   */
  private autoUnitScaling(): number {
    const fs = this.componentStyle(($) => ($["global"]?.["fontSizePx"] || 13.3333) * 0.85 * this.scaleFactor);
    const maxBarWidthPx = this.barColumnMaxWidth * fs;
    const targetWidth = maxBarWidthPx * 0.8;

    const absMax = this.getMaxAbsValue();
    if (absMax <= 0 || fs <= 0) {
      return 0.01;
    }
    return targetWidth / (absMax * fs);
  }

  /**
   * Auto-calculate percentageScaling so the largest relative variance pin
   * fills ~80% of the pin area.
   */
  private autoPercentageScaling(): number {
    const fs = this.componentStyle(($) => ($["global"]?.["fontSizePx"] || 13.3333) * 0.85 * this.scaleFactor);
    const maxPinLength = Math.round(this.barColumnMaxWidth * 0.67 * fs);
    const targetLength = maxPinLength * 0.8;

    const maxPct = this.getMaxRelativeValue();
    if (maxPct <= 0 || fs <= 0) {
      return 0.5;
    }
    return targetLength / (maxPct * fs);
  }

  /**
   * Find the maximum absolute value across all absolute variance columns (d_*) in the table body.
   */
  private getMaxAbsValue(): number {
    if (!this.table) return 0;
    let max = 0;
    for (const row of this.table.getBody()) {
      if (row.type === TableRowType.SUM) continue;
      for (const cell of row.getCells()) {
        if (cell.isBarChart && cell.columnStats && !cell.key.startsWith("dr")) {
          max = Math.max(max, cell.columnStats.absMax);
        }
      }
    }
    return max;
  }

  /**
   * Find the maximum percentage value across all relative variance columns (dr_*) in the table body.
   * Values are stored as decimals (e.g. 0.2 = 20%), returned as percentage (20).
   */
  private getMaxRelativeValue(): number {
    if (!this.table) return 0;
    let max = 0;
    for (const row of this.table.getBody()) {
      if (row.type === TableRowType.SUM) continue;
      for (const cell of row.getCells()) {
        if (cell.isBarChart && cell.columnStats && cell.key.startsWith("dr")) {
          max = Math.max(max, cell.columnStats.absMax * 100);
        }
      }
    }
    return max;
  }
}
