import { Component, Element, h, Host, Method, Prop } from "@stencil/core";

import { OrderDirection, TableRowType, TableType } from "../utils/model";
import {
  CellElement,
  ComponentMetadata,
  LayoutDiagnosticItem,
  LayoutElement,
  LayoutRegion,
  Origins,
  TableDetail,
  TableRowInfo,
  dataPointAttributes,
  measure,
  measureContent,
  measureSign,
  readLayoutPoint,
} from "../../../utils/layoutState";

import { TableRow } from "../utils/elements";
import { Table } from "../utils/Table";

import { TableComponentConfig, TableComponentConfigAdapter } from "../utils/model/TableComponentConfig";
import { TableDrillGroup, TableDrillGroupAdapter } from "../utils/model/TableDrillGroup";
import { TableAttribute } from "../utils/model/TableAttribute";
import { DataFormat, I18nMode, MeasureType, TableCategoryWidth } from "../../../utils/constants";

import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { IBCSRuleSet, stylesBySlot } from "../../../utils/ibcsRuleSet";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";
import { Order, OrderAdapter } from "../../../utils/model/Order";
import {
  CellBarChart,
  CellBarChartStyles,
  formatValue,
  VarianceStyle,
  zeroOnPositiveSide,
} from "../utils/elements/CellBarChart";
import { WaterfallBar } from "../utils/elements/WaterfallBar";
import { Cell } from "../utils/elements/Cell";
import withComponentStatus from "../../../utils/withComponentStatus";
import withComponentStyle from "../../../utils/withComponentStyle";
import { Style } from "../../../stores/componentStyles";
import { AutoScalingReport } from "../../../utils/scaling";
import { getStores, ScopedStores } from "../../../context/context-protocol";
import { sourceExpr } from "../../../context/scopedDb";
import { ErrorDispatcher } from "../../../utils/withHasError";
import {
  absoluteBarGeometry,
  BAR_LABEL_FONT_RATIO,
  estimateLabelWidth,
  PIN_HEAD_SIZE,
  relativePinGeometry,
  SideLabels,
} from "../utils/helper/barColumnGeometry";
import { NOT_AVAILABLE } from "../../../utils/relativeVariance";
import { normalizeFillPattern } from "../../../utils/model/styles/SVGStyle";

/** What the cells of one bar or pin column draw, over all interval buckets. */
interface BarColumnLayout {
  isRelative: boolean;
  /** Largest drawn value, in percent for a pin column. */
  absMax: number;
  labels: SideLabels;
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
 * @internal
 */
@Component({
  tag: "bn-table-renderer",
  styleUrl: "bn-table-renderer.scss",
  shadow: true,
})
export class BnTableRenderer {
  // @ts-ignore - Required by withComponentStyle mixin
  @Element() private element: HTMLElement;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;

  /**
   * Name of the dataset (a table or view in the shared alasql database). The
   * inner `Table` helper queries it directly - no array copy.
   * @internal
   */
  @Prop()
  tableName: string = "";

  /**
   * Bumped by the outer `bn-table` whenever the dataset's data changes. Triggers
   * a re-render via Stencil's prop-change detection.
   * @internal
   */
  @Prop()
  dataVersion: number = 0;

  /**
   * Name of a registered component style, forwarded by the outer `bn-table`.
   * Reflected so the `withComponentStyle` mixin can read the `selected-style`
   * attribute from the host element.
   * @internal
   */
  @Prop({ reflect: true })
  selectedStyle?: string;

  /**
   * Label of the grand-total row (`sum` / `opt` types only). The default
   * `SUM_TOTAL` is an i18n key that resolves to the IBCS total symbol (❖).
   * @internal
   */
  @Prop()
  sumTitle: string = "SUM_TOTAL";

  /** @internal */
  @Prop()
  scenarios: string[] = [];

  /** @internal */
  @Prop()
  scenariosDataFormat: DataFormat = DataFormat.DECIMAL;

  /** @internal */
  @Prop()
  grouped?: boolean = false;

  /** @internal */
  @Prop()
  limit: number = 0;

  /** @internal */
  @Prop()
  showGroupTitle: boolean = true;

  /** @internal */
  @Prop()
  thereof: TableDrillGroup[] = [];

  /** @internal */
  @Prop()
  partof: TableDrillGroup[] = [];

  /** @internal */
  @Prop()
  order: Order = {
    hierarchy: [],
    direction: OrderDirection.ASC,
  };

  /** @internal */
  @Prop()
  categorythereof: Map<string, Record<string, unknown>[]> = new Map();

  /** @internal */
  @Prop()
  attributeColumns: TableAttribute[] = [];

  /** @internal */
  @Prop()
  type: TableType = TableType.LIST;

  /** @internal */
  @Prop()
  categoryWidth: TableCategoryWidth = TableCategoryWidth.INF;

  /** @internal */
  @Prop()
  dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

  /** @internal */
  @Prop()
  ruleSetConfig?: RuleSetConfig;

  /** @internal */
  @Prop({ mutable: true })
  i18n: Map<string, string> = new Map();

  /** @internal */
  @Prop({ attribute: "i18n-mode" })
  i18nMode: I18nMode = I18nMode.ALL;

  /** @internal */
  @Prop()
  measureScale: string = "_";

  /** @internal */
  @Prop()
  measureUnit: string = "";

  /** @internal */
  @Prop()
  showMeasureScale: boolean = true;

  /** @internal */
  @Prop()
  measureType: MeasureType = MeasureType.VOLUME;

  /** @internal */
  @Prop()
  filter: string = "";

  /** @internal */
  @Prop()
  barColumns: string[] = [];

  /** @internal */
  @Prop()
  interval: string = "none";

  /**
   * Total width of a bar chart column, in em of the table font - the same unit
   * `categoryWidth` uses, so the two render at the same width for the same value.
   * @internal
   */
  @Prop()
  barColumnMaxWidth: number = 30;

  /** @internal */
  @Prop()
  unitScaling: number = 0.01;

  /** @internal */
  @Prop()
  percentageScaling: number = 0.5;

  /**
   * Internal wrapper channel: called with the auto-fitted scaling values
   * (em per unit / em per percentage point) whenever one of them was
   * auto-resolved, so the outer `bn-table` can surface them in its AUTO_*
   * warnings. Not for end users.
   * @internal
   */
  @Prop()
  reportAutoScaling?: (report: AutoScalingReport) => void;

  /**
   * The wrapper's error dispatcher: a failed query is reported through it as `ERR_sql`. Not for end users.
   * @internal
   */
  @Prop()
  errors?: ErrorDispatcher;

  /** @internal */
  @Prop()
  scaleFactor: number = 1;

  private table: Table | undefined;
  private componentDataFormatDigits: DataFormatDigits = new DataFormatDigits();
  private barChartStyles: CellBarChartStyles;
  private barColumnLayouts = new Map<string, BarColumnLayout>();
  private stores: ScopedStores | undefined;

  constructor() {
    withComponentStatus(this);
    this.componentStyle = withComponentStyle(this);
  }

  /**
   * Collects the table's layout-state contribution: header/body regions,
   * counts, and - with `detail: "full"` - per-cell geometry paired with the
   * table model (values, column keys, in-cell bar charts). Called by the
   * outer `bn-table`; not for end users.
   * @internal
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
        rows.push({
          section,
          index: rowIndex,
          type: row.type,
          rect: measure(tr, origins),
          point: readLayoutPoint(tr),
        });

        const cells = row.getCells();
        const domCells = Array.from(tr.children);
        if (cells.length !== domCells.length) {
          result.diagnostics.push({
            id: `WARN_layout_cell_pairing_${section}_${rowIndex}`,
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
            point: readLayoutPoint(domCell),
          };
          if (entry.point) {
            entry.content = measureContent(domCell, origins);
            entry.contentSign = measureSign(domCell) || undefined;
          }
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
              <tr class={row.cssStyle} {...dataPointAttributes(row.key, "element")}>
                {row?.getCells().map((cell: Cell) => (
                  <td
                    colSpan={cell.colSpan}
                    class={cell.type ? `${cell.cssStyle} ${cell.type}` : cell.cssStyle}
                    {...(row.key && cell.value != null && cell.value !== "" && cell.value !== "-"
                      ? dataPointAttributes({ ...row.key, date: cell.date, scenario: cell.key }, "element")
                      : {})}
                  >
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
                          isPositiveGood={cell.direction === "pos"}
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
                          isPositiveGood={cell.direction === "pos"}
                          measureScale={barLabelMeasureScale(cell)}
                          locale={locale}
                          percentDigits={this.componentDataFormatDigits.percent}
                          columnWidthEm={this.barColumnMaxWidth}
                          labelWidths={this.barColumnLayouts.get(cell.key)?.labels}
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

    this.componentDataFormatDigits = new DataFormatDigitsAdapter().adapt(
      this.dataFormatDigits as unknown as Record<string, unknown>,
    );
    try {
      const config: TableComponentConfig = this.prepareConfig(db);
      this.table = new Table(new IBCSRuleSet(this.ruleSetConfig), db, this.tableName, config);
      this.table.setI18n(this.i18n);
      // run the queries now: a failure must end as ERR_sql and no table, not as an exception in render()
      if (!this.table.hasNoData()) this.table.getBody();
      this.errors?.remove("ERR_sql");
    } catch (e) {
      console.error("bn-table-renderer: query failed", e);
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
    const orderBucketWarning = this.table?.orderBucketWarning();
    if (orderBucketWarning) {
      this.errors?.addOrReplace({ id: "WARN_orderBucket", type: "warning", message: orderBucketWarning });
    } else {
      this.errors?.remove("WARN_orderBucket");
    }
    this.barColumnLayouts = this.collectBarColumnLayouts();
    this.barChartStyles = this.prepareBarChartStyles();
  }

  private prepareConfig(db: import("../../../context/scopedDb").AlaSQLDatabase): TableComponentConfig {
    const fromExpr = sourceExpr(db, this.tableName, this.filter);
    const config = new TableComponentConfigAdapter(
      new TableDrillGroupAdapter(),
      new StringAdapter(),
      new OrderAdapter(new StringAdapter(), true),
      db,
      fromExpr,
      // a failed measure-scale query ends in the ERR_sql of componentWillRender
      (e) => {
        throw e;
      },
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
      const defaultPos: VarianceStyle = { stroke: "#008f96", fill: "#008f96", fillpattern: "solid" };
      const defaultNeg: VarianceStyle = { stroke: "#ff0000", fill: "#ff0000", fillpattern: "solid" };
      const defaultNeu: VarianceStyle = { stroke: "#808080", fill: "#808080", fillpattern: "outlined" };

      // Default scenario styles (IBCS grayscale)
      const defaultAc: VarianceStyle = { stroke: "#404040", fill: "#404040", fillpattern: "solid" };
      const defaultPp: VarianceStyle = { stroke: "#A6A6A6", fill: "#A6A6A6", fillpattern: "solid" };
      const defaultFc: VarianceStyle = { stroke: "#404040", fill: "#ffffff", fillpattern: "hatched" };
      const defaultPl: VarianceStyle = { stroke: "#404040", fill: "#ffffff", fillpattern: "outlined" };

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
        // each scenario is drawn in the style slot its colorIndex selects
        scenarios: stylesBySlot(
          {
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
          new IBCSRuleSet(this.ruleSetConfig),
        ),
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
   * One scaling for all columns, so it is the smallest that fits every column.
   */
  private autoUnitScaling(): number {
    const emPx = this.emPx();
    const fs = emPx * BAR_LABEL_FONT_RATIO;
    let scaling = Infinity;
    for (const { isRelative, absMax, labels } of this.barColumnLayouts.values()) {
      if (isRelative || absMax <= 0) continue;
      const { maxBarWidth, cutWidth } = absoluteBarGeometry(this.barColumnMaxWidth, emPx, labels);
      scaling = Math.min(scaling, Math.min(maxBarWidth * 0.8, cutWidth) / (absMax * fs));
    }
    return Number.isFinite(scaling) && fs > 0 ? scaling : 0.01;
  }

  /**
   * Auto-calculate percentageScaling so the longest relative variance pin, its head and
   * its label exactly fill the column. One scaling for all columns, the smallest that fits.
   */
  private autoPercentageScaling(): number {
    const emPx = this.emPx();
    const fs = emPx * BAR_LABEL_FONT_RATIO;
    let scaling = Infinity;
    for (const { isRelative, absMax, labels } of this.barColumnLayouts.values()) {
      if (!isRelative || absMax <= 0) continue;
      const headSize = PIN_HEAD_SIZE * this.scaleFactor;
      const { maxPinLength } = relativePinGeometry(this.barColumnMaxWidth, emPx, labels, headSize);
      scaling = Math.min(scaling, maxPinLength / (absMax * fs));
    }
    return Number.isFinite(scaling) && fs > 0 ? scaling : 0.5;
  }

  /**
   * Largest value and widest label per side of every bar and pin column, from the cells
   * that draw one: total rows and n/a draw none. Interval buckets share the column key,
   * so they share the layout and the axis.
   */
  private collectBarColumnLayouts(): Map<string, BarColumnLayout> {
    const layouts = new Map<string, BarColumnLayout>();
    if (!this.table || this.table.hasNoData()) return layouts;

    const cellsByKey = new Map<string, Cell[]>();
    for (const row of this.table.getBody()) {
      if (row.type === TableRowType.SUM) continue;
      for (const cell of row.getCells()) {
        // waterfall cells scale independently
        if (!cell.isBarChart || !cell.columnStats || cell.waterfall !== undefined) continue;
        if (typeof cell.value !== "number" || isNaN(cell.value)) continue;
        cellsByKey.set(cell.key, [...(cellsByKey.get(cell.key) ?? []), cell]);
      }
    }

    const fs = this.emPx() * BAR_LABEL_FONT_RATIO;
    const locale = this.stores?.context?.state?.locale;
    for (const [key, cells] of cellsByKey) {
      const isRelative = key.startsWith("dr");
      const values = cells.map((cell) => cell.value as number);
      const labels: SideLabels = {
        neg: values.some((value) => value < 0) ? 0 : undefined,
        pos: values.some((value) => value > 0) ? 0 : undefined,
      };
      const zeroPositive = zeroOnPositiveSide(labels);
      for (const cell of cells) {
        const value = cell.value as number;
        const side = value > 0 || (value === 0 && zeroPositive) ? "pos" : "neg";
        const text = formatValue(
          value,
          isRelative,
          barLabelMeasureScale(cell),
          locale,
          this.componentDataFormatDigits.percent,
        );
        labels[side] = Math.max(labels[side] ?? 0, estimateLabelWidth(text, fs));
      }
      const absMax = Math.max(...values.map(Math.abs)) * (isRelative ? 100 : 1);
      layouts.set(key, { isRelative, absMax, labels });
    }
    return layouts;
  }
}

/** Percentage points: the fraction times 100, no measure scale. */
function barLabelMeasureScale(cell: Cell): number {
  return cell.type === "percentpoint" ? 0.01 : cell.measureScale;
}
