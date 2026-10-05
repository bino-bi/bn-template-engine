import { Component, Element, h, Host, Method, Prop } from "@stencil/core";

import { OrderDirection, TableRowType, TableType } from "./utils/model";
import {
  CellElement,
  ComponentMetadata,
  LayoutDiagnosticItem,
  LayoutElement,
  LayoutRegion,
  Origins,
  TableDetail,
  TableRowInfo,
  measure,
} from "../../utils/layoutState";

import { TableRow } from "./utils/elements";
import { Table } from "./utils/Table";

import { TableComponentConfig, TableComponentConfigAdapter } from "./utils/model/TableComponentConfig";
import { TableDrillGroup, TableDrillGroupAdapter } from "./utils/model/TableDrillGroup";
import { TableAttribute } from "./utils/model/TableAttribute";
import { DataFormat, I18nMode, MeasureType, TableCategoryWidth } from "../../utils/constants";

import { StringAdapter } from "../../utils/helper/StringAdapter";
import { IBCSRuleSet } from "../../utils/ibcsRuleSet";
import { RuleSetConfig } from "../../stores/ruleSets";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../utils/model/DataFormatDigits";
import { Order, OrderAdapter } from "../../utils/model/Order";
import { CellBarChart, CellBarChartStyles } from "./utils/elements/CellBarChart";
import { WaterfallBar } from "./utils/elements/WaterfallBar";
import { Cell } from "./utils/elements/Cell";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";
import { AutoScalingReport } from "../../utils/scaling";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { buildFromExpr } from "../../context/scopedDb";
import { ErrorDispatcher } from "../../utils/withHasError";
import { absoluteBarGeometry, BAR_LABEL_FONT_RATIO, relativePinGeometry } from "./utils/helper/barColumnGeometry";
import { NOT_AVAILABLE } from "../../utils/relativeVariance";
import { normalizeFillPattern } from "../../utils/model/styles/SVGStyle";

/** Aggregated column statistics driving the auto-fit of one scaling family. */
interface BarColumnStats {
  absMax: number;
  hasNeg: boolean;
  hasPos: boolean;
}

/** Layout-state contribution of the inner table, merged by `bn-table.getLayoutState()`. */
export interface TableLayoutDetail {
  regions: LayoutRegion[];
  metadata: ComponentMetadata;
  diagnostics: LayoutDiagnosticItem[];
  elements?: LayoutElement[];
  table?: TableDetail;
}

/**
 * Internal rendering engine for `bn-table`.
 *
 * Receives pre-validated, typed props from the outer `bn-table` wrapper and
 * builds the IBCS-compliant HTML table - including header rows, scenario
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
   * inner `Table` helper queries it directly - no array copy.
   */
  @Prop()
  tableName: string = "";

  /**
   * Bumped by the outer `bn-table` whenever the dataset's data changes. Triggers
   * a re-render via Stencil's prop-change detection.
   */
  @Prop()
  dataVersion: number = 0;

  /**
   * Name of a registered component style, forwarded by the outer `bn-table`.
   * Reflected so the `withComponentStyle` mixin can read the `selected-style`
   * attribute from the host element.
   */
  @Prop({ reflect: true })
  selectedStyle?: string;

  /**
   * Label of the grand-total row (`sum` / `opt` types only). The default
   * `SUM_TOTAL` is an i18n key that resolves to the IBCS total symbol (❖).
   */
  @Prop()
  sumTitle: string = "SUM_TOTAL";

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

  @Prop()
  ruleSetConfig?: RuleSetConfig;

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
  interval: string = "none";

  /**
   * Total width of a bar chart column, in em of the table font - the same unit
   * `categoryWidth` uses, so the two render at the same width for the same value.
   */
  @Prop()
  barColumnMaxWidth: number = 30;

  @Prop()
  unitScaling: number = 0.01;

  @Prop()
  percentageScaling: number = 0.5;

  /**
   * Internal wrapper channel: called with the auto-fitted scaling values
   * (em per unit / em per percentage point) whenever one of them was
   * auto-resolved, so the outer `bn-table` can surface them in its AUTO_*
   * warnings. Not for end users.
   */
  @Prop()
  reportAutoScaling?: (report: AutoScalingReport) => void;

  /** The wrapper's error dispatcher: a failed query is reported through it as `ERR_sql`. Not for end users. */
  @Prop()
  errors?: ErrorDispatcher;

  @Prop()
  scaleFactor: number = 1;

  private table: Table | undefined;
  private componentDataFormatDigits: DataFormatDigits = new DataFormatDigits();
  private barChartStyles: CellBarChartStyles;
  private stores: ScopedStores | undefined;

  constructor() {
    this.componentStyle = withComponentStyle(this);
  }

  /**
   * Collects the table's layout-state contribution: header/body regions,
   * counts, and - with `detail: "full"` - per-cell geometry paired with the
   * table model (values, column keys, in-cell bar charts). Called by the
   * outer `bn-table`; not for end users.
   */
  @Method()
  async getLayoutDetail(origins: Origins, detail: "summary" | "full"): Promise<TableLayoutDetail> {
    const result: TableLayoutDetail = { regions: [], metadata: {}, diagnostics: [] };
    const tableEl = this.element.shadowRoot?.querySelector("table");
    result.metadata.hasNoData = this.table?.hasNoData() ?? true;
    if (!this.table || !tableEl) {
      return result;
    }

    const thead = tableEl.querySelector("thead");
    const tbody = tableEl.querySelector("tbody");
    if (thead) result.regions.push({ id: "header", rect: measure(thead, origins) });
    if (tbody) result.regions.push({ id: "body", rect: measure(tbody, origins) });

    const headerRows = this.table.getHeader();
    const bodyRows = this.table.getBody();
    const columns = this.table.getColumns();
    result.metadata.headerRowCount = headerRows.length;
    result.metadata.rowCount = bodyRows.length;
    result.metadata.columnCount = columns.length;
    result.metadata.cellCount = bodyRows.reduce((count, row) => count + row.getCells().length, 0);

    if (detail !== "full") {
      return result;
    }

    const rows: TableRowInfo[] = [];
    const elements: LayoutElement[] = [];
    const walk = (section: "header" | "body", modelRows: TableRow[], container: Element | null) => {
      const domRows = container ? Array.from(container.children).filter((child) => child.localName === "tr") : [];
      modelRows.forEach((row, rowIndex) => {
        const tr = domRows[rowIndex];
        if (!tr) return;
        rows.push({ section, index: rowIndex, type: row.type, rect: measure(tr, origins) });

        const cells = row.getCells();
        const domCells = Array.from(tr.children);
        if (cells.length !== domCells.length) {
          result.diagnostics.push({
            id: `LAYOUT_cellPairing_${section}_${rowIndex}`,
            type: "warning",
            message: `layout-state: model/DOM cell count mismatch in ${section} row ${rowIndex} (${cells.length} vs ${domCells.length}); cell details skipped for this row.`,
          });
          return;
        }

        cells.forEach((cell, cellIndex) => {
          const domCell = domCells[cellIndex];
          const entry: CellElement = {
            kind: section === "header" ? "headerCell" : "cell",
            row: rowIndex,
            column: cell.index,
            key: cell.key || undefined,
            colSpan: cell.colSpan,
            value: cell.value ?? undefined,
            text: domCell.textContent?.trim() || undefined,
            type: cell.type || undefined,
            rect: measure(domCell, origins),
          };
          const barSvg = domCell.querySelector("svg.cell-bar-chart");
          if (barSvg) {
            entry.bar = {
              variant: barSvg.classList.contains("waterfall-bar")
                ? "waterfall"
                : barSvg.classList.contains("relative-variance")
                  ? "relative"
                  : "absolute",
              rect: measure(barSvg, origins),
            };
          }
          elements.push(entry);
        });
      });
    };
    walk("header", headerRows, thead);
    walk("body", bodyRows, tbody);

    result.elements = elements;
    result.table = {
      rows,
      columns: columns.map((column, index) => ({
        index,
        key: column.name,
        group: column.group,
        type: column.type,
        bucket: column.bucket,
      })),
    };
    return result;
  }

  render() {
    const helper = () => {
      if (this.table === undefined) {
        return;
      }

      if (this.table.hasNoData()) {
        const errorMsg: string = this.i18n.get("no-data") ?? "No Data";
        return <div class="empty-state">{errorMsg}</div>;
      }

      const locale = this.stores?.context?.state?.locale;

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
                    {cell.isBarChart &&
                    cell.columnStats &&
                    cell.value !== NOT_AVAILABLE &&
                    (cell.waterfall !== undefined || row.type !== TableRowType.SUM) ? (
                      cell.waterfall !== undefined ? (
                        <WaterfallBar
                          value={cell.value as number}
                          scenario={cell.key}
                          columnStats={cell.columnStats}
                          height={18 * this.scaleFactor}
                          isRelative={false}
                          isPositiveGood={cell.key.endsWith("_pos")}
                          measureScale={cell.measureScale}
                          locale={locale}
                          columnWidthEm={this.barColumnMaxWidth}
                          styles={this.barChartStyles}
                          waterfall={cell.waterfall}
                        />
                      ) : (
                        <CellBarChart
                          value={cell.value as number}
                          scenario={cell.key}
                          columnStats={cell.columnStats}
                          height={18 * this.scaleFactor}
                          isRelative={cell.key.startsWith("dr")}
                          isPositiveGood={cell.key.endsWith("_pos")}
                          // percentage points: the fraction times 100, no measure scale
                          measureScale={cell.type === "percentpoint" ? 0.01 : cell.measureScale}
                          locale={locale}
                          percentDigits={this.componentDataFormatDigits.percent}
                          columnWidthEm={this.barColumnMaxWidth}
                          styles={this.barChartStyles}
                        />
                      )
                    ) : (
                      cell.draw(this.componentDataFormatDigits, locale)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    };

    return <Host class={{ "no-data": this.table?.hasNoData() === true }}>{helper()}</Host>;
  }

  componentWillRender() {
    if (!this.stores) this.stores = getStores(this.element);
    const db = this.stores.db.db;

    const config: TableComponentConfig = this.prepareConfig(db);

    this.componentDataFormatDigits = new DataFormatDigitsAdapter().adapt(
      this.dataFormatDigits as unknown as Record<string, unknown>,
    );
    try {
      this.table = new Table(new IBCSRuleSet(this.ruleSetConfig), db, this.tableName, config);
      this.table.setI18n(this.i18n);
      // run the queries now: a failure must end as ERR_sql and no table, not as an exception in render()
      if (!this.table.hasNoData()) this.table.getBody();
      this.errors?.remove("ERR_sql");
    } catch (e) {
      console.error("ibcs-table: query failed", e);
      this.table = undefined;
      this.errors?.addOrReplace({
        id: "ERR_sql",
        type: "error",
        message: `Query failed: ${e instanceof Error ? e.message : e}`,
      });
    }
    if (this.table?.hasBlankRowGroup()) {
      this.errors?.addOrReplace({
        id: "WARN_blankRowGroup",
        type: "warning",
        message: "grouped: rows with blank rowGroup found, they are grouped under '-'.",
      });
    } else {
      this.errors?.remove("WARN_blankRowGroup");
    }
    this.barChartStyles = this.prepareBarChartStyles();
  }

  private prepareConfig(db: import("../../context/scopedDb").AlaSQLDatabase): TableComponentConfig {
    const fromExpr = this.tableName ? buildFromExpr(this.tableName, this.filter) : "";
    const config = new TableComponentConfigAdapter(
      new TableDrillGroupAdapter(),
      new StringAdapter(),
      new OrderAdapter(new StringAdapter()),
      db,
      fromExpr,
    ).adapt({
      title: this.sumTitle,
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
      interval: this.interval,
      locale: this.stores?.context?.state?.locale || "de",
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
    const autoUnit = !(this.unitScaling > 0);
    const autoPercent = !(this.percentageScaling > 0);
    const resolvedUnit = autoUnit ? this.autoUnitScaling() : this.unitScaling;
    const resolvedPercent = autoPercent ? this.autoPercentageScaling() : this.percentageScaling;
    if (autoUnit || autoPercent) {
      this.reportAutoScaling?.({
        unit: autoUnit ? resolvedUnit : undefined,
        percentage: autoPercent ? resolvedPercent : undefined,
      });
    }

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

      return {
        positive: {
          stroke: varianceStyles?.pos?.stroke || defaultPos.stroke,
          fill: varianceStyles?.pos?.fill || defaultPos.fill,
          fillpattern: normalizeFillPattern(varianceStyles?.pos?.fillpattern) || defaultPos.fillpattern,
        },
        negative: {
          stroke: varianceStyles?.neg?.stroke || defaultNeg.stroke,
          fill: varianceStyles?.neg?.fill || defaultNeg.fill,
          fillpattern: normalizeFillPattern(varianceStyles?.neg?.fillpattern) || defaultNeg.fillpattern,
        },
        neutral: {
          stroke: varianceStyles?.neu?.stroke || defaultNeu.stroke,
          fill: varianceStyles?.neu?.fill || defaultNeu.fill,
          fillpattern: normalizeFillPattern(varianceStyles?.neu?.fillpattern) || defaultNeu.fillpattern,
        },
        scenarios: {
          ac: {
            stroke: barStyles?.ac?.stroke || defaultAc.stroke,
            fill: barStyles?.ac?.fill || defaultAc.fill,
            fillpattern: normalizeFillPattern(barStyles?.ac?.fillpattern) || defaultAc.fillpattern,
          },
          pp: {
            stroke: barStyles?.pp?.stroke || defaultPp.stroke,
            fill: barStyles?.pp?.fill || defaultPp.fill,
            fillpattern: normalizeFillPattern(barStyles?.pp?.fillpattern) || defaultPp.fillpattern,
          },
          fc: {
            stroke: barStyles?.fc?.stroke || defaultFc.stroke,
            fill: barStyles?.fc?.fill || defaultFc.fill,
            fillpattern: normalizeFillPattern(barStyles?.fc?.fillpattern) || defaultFc.fillpattern,
          },
          pl: {
            stroke: barStyles?.pl?.stroke || defaultPl.stroke,
            fill: barStyles?.pl?.fill || defaultPl.fill,
            fillpattern: normalizeFillPattern(barStyles?.pl?.fillpattern) || defaultPl.fillpattern,
          },
        },
        fontColor: $["global"]?.["fontColor"] || "#000000",
        fontSize: ($["global"]?.["fontSizePx"] || 13.3333) * BAR_LABEL_FONT_RATIO * this.scaleFactor,
        emPx: ($["global"]?.["fontSizePx"] || 13.3333) * this.scaleFactor,
        fontFamily: $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
        unitScaling: resolvedUnit,
        percentageScaling: resolvedPercent,
        scaleFactor: this.scaleFactor,
      };
    });
  }

  /** The table's true em in px - the unit `.category-wN` and the bar columns share. */
  private emPx(): number {
    return this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333) * this.scaleFactor;
  }

  /**
   * Auto-calculate unitScaling so the largest absolute variance bar
   * fills ~80% of its side of the bar area, without tripping the overdrive break.
   */
  private autoUnitScaling(): number {
    const emPx = this.emPx();
    const fs = emPx * BAR_LABEL_FONT_RATIO;
    const { absMax, hasNeg, hasPos } = this.getAbsBarColumnStats();
    if (absMax <= 0 || fs <= 0) {
      return 0.01;
    }

    const { maxBarWidth, cutWidth } = absoluteBarGeometry(this.barColumnMaxWidth, emPx, hasNeg, hasPos);
    const targetWidth = Math.min(maxBarWidth * 0.8, cutWidth);
    return targetWidth / (absMax * fs);
  }

  /**
   * Auto-calculate percentageScaling so the largest relative variance pin
   * fills ~80% of the pin area.
   */
  private autoPercentageScaling(): number {
    const emPx = this.emPx();
    const fs = emPx * BAR_LABEL_FONT_RATIO;
    const { absMax: maxPct, hasNeg, hasPos } = this.getRelativeBarColumnStats();
    if (maxPct <= 0 || fs <= 0) {
      return 0.5;
    }

    const { maxPinLength } = relativePinGeometry(this.barColumnMaxWidth, emPx, hasNeg, hasPos);
    return (maxPinLength * 0.8) / (maxPct * fs);
  }

  /**
   * Maximum value and sign coverage across all absolute variance columns (d_*) in the table body.
   * Sign coverage decides how much of the column the bar area gets (see barColumnGeometry.ts);
   * OR-ing it across columns keeps the single shared scaling inside the narrowest bar area.
   */
  private getAbsBarColumnStats(): BarColumnStats {
    // waterfall cells scale independently and must not skew variance auto-scaling
    return this.collectBarColumnStats((cell) => !cell.key.startsWith("dr") && !cell.waterfall, 1);
  }

  /**
   * Same for the relative variance columns (dr_*). Values are stored as decimals
   * (e.g. 0.2 = 20%), returned as percentage (20).
   */
  private getRelativeBarColumnStats(): BarColumnStats {
    return this.collectBarColumnStats((cell) => cell.key.startsWith("dr"), 100);
  }

  private collectBarColumnStats(accept: (cell: Cell) => boolean, valueFactor: number): BarColumnStats {
    const stats: BarColumnStats = { absMax: 0, hasNeg: false, hasPos: false };
    if (!this.table) return stats;

    for (const row of this.table.getBody()) {
      if (row.type === TableRowType.SUM) continue;
      for (const cell of row.getCells()) {
        if (!cell.isBarChart || !cell.columnStats || !accept(cell)) continue;
        stats.absMax = Math.max(stats.absMax, cell.columnStats.absMax * valueFactor);
        stats.hasNeg = stats.hasNeg || cell.columnStats.min < 0;
        stats.hasPos = stats.hasPos || cell.columnStats.max > 0;
      }
    }
    return stats;
  }
}
