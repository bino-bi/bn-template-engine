import { Component, Element, forceUpdate, h, Host, Method, Prop } from "@stencil/core";

import { OrderDirection, TableRowType, TableType, ThereofPosition } from "../utils/model";
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

import { TableComponentConfig, TableComponentConfigAdapter, TableRatio } from "../utils/model/TableComponentConfig";
import { TableDrillGroup, TableDrillGroupAdapter } from "../utils/model/TableDrillGroup";
import { TableAttribute } from "../utils/model/TableAttribute";
import { DataFormat, I18nMode, MeasureType, TableCategoryWidth } from "../../../utils/constants";

import { StringAdapter } from "../../../utils/helper/StringAdapter";
import { IBCSRuleSet, stylesBySlot } from "../../../utils/ibcsRuleSet";
import { RuleSetConfig } from "../../../stores/ruleSets";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../../utils/model/DataFormatDigits";
import { Order, OrderAdapter } from "../../../utils/model/Order";
import {
  AXIS_COLOR,
  CellBarChart,
  CellBarChartStyles,
  formatValue,
  VarianceStyle,
  zeroOnPositiveSide,
} from "../utils/elements/CellBarChart";
import { WaterfallBar, waterfallLabelText } from "../utils/elements/WaterfallBar";
import { Cell } from "../utils/elements/Cell";
import withComponentStatus from "../../../utils/withComponentStatus";
import withComponentStyle from "../../../utils/withComponentStyle";
import { Style } from "../../../stores/componentStyles";
import { AutoScalingReport, formatScalingValue } from "../../../utils/scaling";
import { getStores, ScopedStores } from "../../../context/context-protocol";
import { sourceExpr } from "../../../context/scopedDb";
import { ErrorDispatcher } from "../../../utils/withHasError";
import {
  absoluteBarGeometry,
  BAR_LABEL_FONT_RATIO,
  labelWidth,
  PIN_HEAD_SIZE,
  pinLabelsFit,
  relativePinGeometry,
  SideLabels,
  WaterfallColumnLabels,
  waterfallGeometry,
  WaterfallGeometry,
  waterfallGeometryAt,
} from "../utils/helper/barColumnGeometry";
import { NOT_AVAILABLE } from "../../../utils/relativeVariance";
import { normalizeFillPattern } from "../../../utils/model/styles/SVGStyle";
import { VarianceScenario } from "../../../utils/model/VarianceScenario";

/** Extra gap before the first column of a block, in table em. */
const BLOCK_GAP_EM = 0.6;

/** What the cells of one bar or pin column draw, over all interval buckets. */
interface BarColumnLayout {
  isRelative: boolean;
  /** Largest drawn value, in percent for a pin column. */
  absMax: number;
  labels: SideLabels;
  /** Largest absolute drawn value per side of the axis; a side without values is undefined. */
  sideMax: SideLabels;
  /** Label format of a pin column, reduced until its labels fit the column. */
  percentDigits: number;
  percentSign: boolean;
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
  runningSum: boolean = false;

  /** @internal */
  @Prop()
  varianceWaterfall: boolean = false;

  /** @internal */
  @Prop()
  thereof: TableDrillGroup[] = [];

  /** @internal */
  @Prop()
  thereofPosition: ThereofPosition = ThereofPosition.BELOW;

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

  /** @internal */
  @Prop()
  categoryIntervalPosition: number = 0;

  /**
   * Total width of a bar chart column, in em of the table font - the same unit
   * `categoryWidth` uses, so the two render at the same width for the same value.
   * @internal
   */
  @Prop()
  barColumnMaxWidth: number = 30;

  /**
   * Width of single bar columns in em, by column key. A column without an entry takes
   * `barColumnMaxWidth`.
   * @internal
   */
  @Prop()
  barColumnWidths: Record<string, number> = {};

  /** @internal */
  @Prop()
  unitScaling: number = 0.01;

  /** @internal */
  @Prop()
  percentageScaling: number = 0.5;

  /**
   * `column`: each waterfall column fits its walk to its own width. `unit`: the waterfall
   * columns and the absolute variance bars share the scale of `unitScaling`.
   * @internal
   */
  @Prop()
  waterfallScaling: "column" | "unit" = "column";

  /**
   * Variance bars and pins also on the sum rows.
   * @internal
   */
  @Prop()
  sumBars: boolean = false;

  /**
   * Waterfall column to the scenario drawn inside its bars, for example `{ fc1: "ac1" }`.
   * @internal
   */
  @Prop()
  barColumnParts: Record<string, string> = {};

  /**
   * Ratio rows after a result row, for example `[{ name: "Gross margin", numerator: "Operating result", denominator: "Sales revenue" }]`.
   * @internal
   */
  @Prop()
  ratios: TableRatio[] = [];

  /**
   * Space between two rows in px, set by `fillHeight` of the wrapper.
   * @internal
   */
  @Prop()
  rowGap: number = 0;

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
  private blockStarts = new Set<number>();
  private barColumnLayouts = new Map<string, BarColumnLayout>();
  private waterfallGeometries = new Map<string, WaterfallGeometry>();
  private waterfallColumns = new Map<string, WaterfallColumnLabels>();
  private stores: ScopedStores | undefined;

  constructor() {
    withComponentStatus(this);
    this.componentStyle = withComponentStyle(this);
  }

  // labels measured in the fallback font are too narrow or too wide once the web font is there: lay out again
  private readonly relayout = () => {
    if (this.barColumnLayouts.size > 0 || this.waterfallGeometries.size > 0) forceUpdate(this);
  };

  connectedCallback() {
    document.fonts?.addEventListener("loadingdone", this.relayout);
  }

  disconnectedCallback() {
    document.fonts?.removeEventListener("loadingdone", this.relayout);
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
        <table
          class={{ "grouped-list": this.groupedList(), "relative-upright": !this.relativeItalic() }}
          style={{
            "--bn-block-gap": `${BLOCK_GAP_EM * this.emPx()}px`,
            ...(this.rowGap > 0 ? { "--bn-row-gap": `${this.rowGap}px` } : {}),
          }}
        >
          <thead>
            {this.table.getHeader().map((row: TableRow) => (
              <tr class={row.cssStyle}>
                {row.getCells().map((cell, i, cells) => (
                  <th
                    colSpan={cell.colSpan}
                    class={`${cell.cssStyle}${this.isBarColumn(cell.key) ? " barColumn" : ""}${this.barPartName(cell) ? " has-bar-part" : ""}${this.blockStartClass(cells, i)}`}
                  >
                    {this.barPartName(cell) && <span class="bar-part-name">{this.barPartName(cell)}</span>}
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
                {row?.getCells().map((cell: Cell, i, cells) => (
                  <td
                    colSpan={cell.colSpan}
                    class={
                      (cell.type ? `${this.cellClass(cell, locale)} ${cell.type}` : cell.cssStyle) +
                      this.blockStartClass(cells, i)
                    }
                    {...(row.key && cell.value != null && cell.value !== "" && cell.value !== "-"
                      ? dataPointAttributes({ ...row.key, date: cell.date, scenario: cell.key }, "element")
                      : {})}
                  >
                    {cell.prefix != null ? (
                      <span class={this.cellClass(cell, locale) + " " + cell.prefixStyle}>{cell.drawPrefix()}</span>
                    ) : (
                      ""
                    )}
                    {cell.isBarChart &&
                    cell.columnStats &&
                    cell.value !== NOT_AVAILABLE &&
                    // an untitled group head is only a gap between list groups, a bar cell would print "-" in it
                    (this.showGroupTitle || row.type !== TableRowType.HEADER) &&
                    (cell.waterfall !== undefined ||
                      row.type !== TableRowType.SUM ||
                      (this.sumBars && cell.direction !== undefined)) &&
                    // a variance walk where every step is zero has no extent: the rows print their zero
                    !(cell.direction !== undefined && cell.waterfall && cell.waterfall.max === cell.waterfall.min) ? (
                      cell.waterfall !== undefined ? (
                        <WaterfallBar
                          value={cell.value as number}
                          scenario={cell.key}
                          columnStats={cell.columnStats}
                          height={18 * this.scaleFactor}
                          isRelative={false}
                          isPositiveGood={cell.direction === "pos"}
                          measureScale={barLabelMeasureScale(cell)}
                          locale={locale}
                          decimalDigits={barLabelDigits(cell, this.componentDataFormatDigits)}
                          columnWidthEm={this.barWidthOf(cell.key)}
                          styles={this.barChartStyles}
                          waterfall={cell.waterfall}
                          geometry={this.waterfallGeometries.get(cell.key)}
                          bold={isBoldRow(row)}
                          connectorReach={this.connectorReach(row)}
                          axisReach={this.axisReach(row)}
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
                          decimalDigits={barLabelDigits(cell, this.componentDataFormatDigits)}
                          percentDigits={
                            this.barColumnLayouts.get(cell.key)?.percentDigits ?? this.componentDataFormatDigits.percent
                          }
                          percentSign={this.barColumnLayouts.get(cell.key)?.percentSign}
                          columnWidthEm={this.barWidthOf(cell.key)}
                          labelWidths={this.barColumnLayouts.get(cell.key)?.labels}
                          sideMax={this.barColumnLayouts.get(cell.key)?.sideMax}
                          bold={isBoldRow(row)}
                          styles={this.barChartStyles}
                          axisReach={this.axisReach(row)}
                        />
                      )
                    ) : cell.ratioLine ? (
                      this.ratioCell(cell, row, locale)
                    ) : cell.axisOnly && cell.columnStats ? (
                      <CellBarChart
                        value={0}
                        scenario={cell.key}
                        columnStats={cell.columnStats}
                        height={18 * this.scaleFactor}
                        isRelative={cell.key.startsWith("dr")}
                        isPositiveGood={true}
                        columnWidthEm={this.barWidthOf(cell.key)}
                        labelWidths={this.barColumnLayouts.get(cell.key)?.labels}
                        sideMax={this.barColumnLayouts.get(cell.key)?.sideMax}
                        styles={this.barChartStyles}
                        axisReach={this.connectorReach(row)}
                        axisOnly={true}
                      />
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
    const positionWarning = this.table?.categoryIntervalPositionWarning();
    for (const id of ["WARN_categoryIntervalPositionNoInterval", "WARN_categoryIntervalPositionRange"] as const) {
      if (positionWarning?.id === id) {
        this.errors?.addOrReplace({ id, type: "warning", message: positionWarning.message });
      } else {
        this.errors?.remove(id);
      }
    }
    this.blockStarts = this.collectBlockStarts();
    this.barColumnLayouts = this.collectBarColumnLayouts();
    this.waterfallGeometries = this.collectWaterfallGeometries();
    this.barChartStyles = this.prepareBarChartStyles();
  }

  /**
   * The columns that start a block: the row header, the scenarios of one interval bucket
   * and each pair of variances are blocks. IBCS sets them apart by a wider gap.
   */
  private collectBlockStarts(): Set<number> {
    const starts = new Set<number>();
    if (!this.table || this.table.hasNoData()) return starts;
    const blockOf = (column: { type: string; bucket?: string }) => {
      const variance = new VarianceScenario(column.type);
      const kind = variance.isValid
        ? `${variance.base}_${variance.delta}`
        : /^(ac|pp|fc|pl)\d/i.test(column.type)
          ? "scenario"
          : "rowheader";
      return `${column.bucket ?? ""}|${kind}`;
    };
    const blocks = this.table.getColumns().map(blockOf);
    blocks.forEach((block, i) => {
      if (i > 0 && block !== blocks[i - 1]) starts.add(i);
    });
    return starts;
  }

  /** " block-start" for the cell whose first column starts a block. A cell can span columns. */
  private blockStartClass(cells: Cell[], index: number): string {
    let column = 0;
    for (let i = 0; i < index; i++) column += cells[i].colSpan;
    return this.blockStarts.has(column) ? " block-start" : "";
  }

  /** A grouped table that is no calculation scheme: its groups stand further apart. */
  private groupedList(): boolean {
    return this.grouped === true && this.type !== TableType.OPT && this.type !== TableType.OPTNOTOTAL;
  }

  /**
   * The value of a ratio row in a waterfall column: left of the line of the walk, which
   * runs through the row with the zero axis. Without the column geometry the plain value.
   */
  private ratioCell(cell: Cell, row: TableRow, locale?: string) {
    const text = cell.draw(this.componentDataFormatDigits, locale);
    const geometry = this.waterfallGeometries.get(cell.key);
    const { at, min, max } = cell.ratioLine!;
    if (!geometry || !(max > min)) return text;
    const height = 18 * this.scaleFactor;
    const xOf = (value: number) => geometry.labelAreaLeft + (value - min) * (geometry.barAreaWidth / (max - min));
    const x = xOf(at);
    const zeroX = xOf(0);
    const reach = this.connectorReach(row);
    const styles = this.barChartStyles;
    return (
      <svg
        width={geometry.totalWidth}
        height={height}
        class="cell-bar-chart ratio-line"
        style={{ overflow: "visible" }}
      >
        {min <= 0 && max >= 0 && (
          <line
            x1={zeroX}
            y1={-reach.top}
            x2={zeroX}
            y2={height + reach.bottom}
            stroke={AXIS_COLOR}
            stroke-width={1 * this.scaleFactor}
          />
        )}
        <line
          x1={x}
          y1={-reach.top}
          x2={x}
          y2={height + reach.bottom}
          stroke={AXIS_COLOR}
          stroke-width={1 * this.scaleFactor}
        />
        <text
          x={x - geometry.labelGap}
          y={height / 2}
          dy="0.35em"
          text-anchor="end"
          fill={styles.fontColor}
          font-size={styles.fontSize}
          font-family={styles.fontFamily}
          font-style="italic"
        >
          {text}
        </text>
      </svg>
    );
  }

  /** The name of the scenario drawn inside the bars of a waterfall column, for the header cell with its name. */
  private barPartName(cell: Cell): string | undefined {
    const part = this.barColumnParts?.[cell.key];
    if (!part || !this.waterfallColumns.has(cell.key)) return undefined;
    // a column has a header cell in every header row, only the one with a name gets the part
    if (!cell.getAsHeaderList().some((line) => String(line ?? "").trim() !== "")) return undefined;
    return this.table?.scenarioLabel(part);
  }

  /** The width of a bar column in em: its own entry of `barColumnWidths`, else the common width. */
  private barWidthOf(key: string): number {
    return this.barColumnWidths?.[key] ?? this.barColumnMaxWidth;
  }

  private isBarColumn(key: string): boolean {
    return this.barColumns.includes(key);
  }

  /** The classes of a number cell. A variance that prints as zero loses its sign and its sentiment color. */
  private cellClass(cell: Cell, locale?: string): string {
    if (cell.direction === undefined || !cell.roundsToZero(this.componentDataFormatDigits, locale)) {
      return cell.cssStyle;
    }

    return cell.cssStyle.replace(/^(pos|neg)_\w+/, "zero");
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
      runningSum: this.runningSum,
      varianceWaterfall: this.varianceWaterfall,
      sumBars: this.sumBars,
      barColumnParts: this.barColumnParts,
      ratios: this.ratios,
      thereOf: this.thereof,
      thereOfPosition: this.thereofPosition,
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
      categoryIntervalPosition: this.categoryIntervalPosition,
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
    const fittedUnit = autoUnit ? this.autoUnitScaling() : undefined;
    let resolvedUnit = autoUnit ? (fittedUnit ?? 0.01) : this.unitScaling;
    const walkUnit = this.waterfallScaling === "unit" ? this.waterfallUnitScaling() : undefined;
    let walkTooLong = false;
    if (walkUnit !== undefined) {
      if (autoUnit) {
        resolvedUnit = Math.min(fittedUnit ?? Infinity, walkUnit);
      } else if (resolvedUnit > walkUnit * (1 + 1e-9)) {
        // a walk cannot be cut like a single bar, so the whole table gets smaller
        walkTooLong = true;
        this.errors?.addOrReplace({
          id: "WARN_waterfallScaling",
          type: "warning",
          message: `waterfallScaling: at unit-scaling 1 em = ${formatScalingValue(1 / this.unitScaling)} units a waterfall does not fit its column. All bars of the table use 1 em ≈ ${formatScalingValue(1 / walkUnit)} units.`,
        });
        resolvedUnit = walkUnit;
      }
      const px = resolvedUnit * this.emPx() * BAR_LABEL_FONT_RATIO;
      for (const [key, column] of this.waterfallColumns) {
        if (column.max - column.min > 0) {
          this.waterfallGeometries.set(key, waterfallGeometryAt(this.barWidthOf(key), this.emPx(), column, px));
        }
      }
    }
    if (!walkTooLong) this.errors?.remove("WARN_waterfallScaling");
    const resolvedPercent = autoPercent ? this.autoPercentageScaling() : this.percentageScaling;
    if (autoUnit || autoPercent) {
      this.reportAutoScaling?.({
        unit: autoUnit ? resolvedUnit : undefined,
        percentage: autoPercent ? resolvedPercent : undefined,
      });
    }

    return this.barStylesFromStore(resolvedUnit, resolvedPercent);
  }

  private barStylesFromStore(resolvedUnit: number, resolvedPercent: number): CellBarChartStyles {
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
          outlineFill: varianceStyles?.pos?.outlineFill || undefined,
          outlineStroke: varianceStyles?.pos?.outlineStroke || undefined,
        },
        negative: {
          stroke: varianceStyles?.neg?.stroke || defaultNeg.stroke,
          fill: varianceStyles?.neg?.fill || defaultNeg.fill,
          fillpattern: normalizeFillPattern(varianceStyles?.neg?.fillpattern) || defaultNeg.fillpattern,
          outlineFill: varianceStyles?.neg?.outlineFill || undefined,
          outlineStroke: varianceStyles?.neg?.outlineStroke || undefined,
        },
        neutral: {
          stroke: varianceStyles?.neu?.stroke || defaultNeu.stroke,
          fill: varianceStyles?.neu?.fill || defaultNeu.fill,
          fillpattern: normalizeFillPattern(varianceStyles?.neu?.fillpattern) || defaultNeu.fillpattern,
          outlineFill: varianceStyles?.neu?.outlineFill || undefined,
          outlineStroke: varianceStyles?.neu?.outlineStroke || undefined,
        },
        // each scenario is drawn in the style slot its colorIndex selects
        scenarios: stylesBySlot(
          {
            ac: {
              stroke: barStyles?.ac?.stroke || defaultAc.stroke,
              fill: barStyles?.ac?.fill || defaultAc.fill,
              fillpattern: normalizeFillPattern(barStyles?.ac?.fillpattern) || defaultAc.fillpattern,
              negativeFill: barStyles?.ac?.negativeFill || undefined,
            },
            pp: {
              stroke: barStyles?.pp?.stroke || defaultPp.stroke,
              fill: barStyles?.pp?.fill || defaultPp.fill,
              fillpattern: normalizeFillPattern(barStyles?.pp?.fillpattern) || defaultPp.fillpattern,
              negativeFill: barStyles?.pp?.negativeFill || undefined,
            },
            fc: {
              stroke: barStyles?.fc?.stroke || defaultFc.stroke,
              fill: barStyles?.fc?.fill || defaultFc.fill,
              fillpattern: normalizeFillPattern(barStyles?.fc?.fillpattern) || defaultFc.fillpattern,
              negativeFill: barStyles?.fc?.negativeFill || undefined,
            },
            pl: {
              stroke: barStyles?.pl?.stroke || defaultPl.stroke,
              fill: barStyles?.pl?.fill || defaultPl.fill,
              fillpattern: normalizeFillPattern(barStyles?.pl?.fillpattern) || defaultPl.fillpattern,
              negativeFill: barStyles?.pl?.negativeFill || undefined,
            },
          },
          new IBCSRuleSet(this.ruleSetConfig),
        ),
        fontColor: $["global"]?.["fontColor"] || "#000000",
        fontSize: ($["global"]?.["fontSizePx"] || 13.3333) * BAR_LABEL_FONT_RATIO * this.scaleFactor,
        emPx: ($["global"]?.["fontSizePx"] || 13.3333) * this.scaleFactor,
        fontFamily: this.labelFontFamily(),
        unitScaling: resolvedUnit,
        percentageScaling: resolvedPercent,
        scaleFactor: this.scaleFactor,
        relativeItalic: this.relativeItalic(),
      };
    });
  }

  /** False when the style prints relative variances upright. */
  private relativeItalic(): boolean {
    return this.componentStyle(($) => $["bn-table"]?.relativeItalic) !== false;
  }

  /** Font family of the bar and pin labels, also used to measure them. */
  private labelFontFamily(): string {
    return this.componentStyle(($) => $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif");
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
  private autoUnitScaling(): number | undefined {
    const emPx = this.emPx();
    const fs = emPx * BAR_LABEL_FONT_RATIO;
    let scaling = Infinity;
    for (const [key, { isRelative, absMax, labels, sideMax }] of this.barColumnLayouts) {
      if (isRelative || absMax <= 0) continue;
      const geometry = absoluteBarGeometry(this.barWidthOf(key), emPx, labels, sideMax);
      for (const side of ["neg", "pos"] as const) {
        const max = sideMax[side] ?? 0;
        if (max <= 0) continue;
        const { maxBarWidth, cutWidth } = geometry[side];
        scaling = Math.min(scaling, Math.min(maxBarWidth * 0.8, cutWidth) / (max * fs));
      }
    }
    return Number.isFinite(scaling) && fs > 0 ? scaling : undefined;
  }

  /**
   * The largest unitScaling at which every waterfall walk fits its column: the smallest
   * scale of the columns. Undefined without a waterfall column.
   */
  private waterfallUnitScaling(): number | undefined {
    const fs = this.emPx() * BAR_LABEL_FONT_RATIO;
    let scaling = Infinity;
    for (const [key, column] of this.waterfallColumns) {
      const range = column.max - column.min;
      const geometry = this.waterfallGeometries.get(key);
      if (range <= 0 || !geometry) continue;
      scaling = Math.min(scaling, geometry.barAreaWidth / (range * fs));
    }
    return Number.isFinite(scaling) && fs > 0 ? scaling : undefined;
  }

  /**
   * Auto-calculate percentageScaling so the longest relative variance pin, its head and
   * its label exactly fill the column. One scaling for all columns, the smallest that fits.
   */
  private autoPercentageScaling(): number {
    const emPx = this.emPx();
    const fs = emPx * BAR_LABEL_FONT_RATIO;
    let scaling = Infinity;
    for (const [key, { isRelative, absMax, labels, sideMax }] of this.barColumnLayouts) {
      if (!isRelative || absMax <= 0) continue;
      const headSize = PIN_HEAD_SIZE * this.scaleFactor;
      // the longest pins of both sides share the room, each side takes what its pins need
      const { negPinLength, posPinLength } = relativePinGeometry(this.barWidthOf(key), emPx, labels, headSize);
      const percent = ((sideMax.neg ?? 0) + (sideMax.pos ?? 0)) * 100;
      scaling = Math.min(scaling, (negPinLength + posPinLength) / (percent * fs));
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

    // a cell with the weight its row prints in
    const cellsByKey = new Map<string, { cell: Cell; bold: boolean }[]>();
    for (const row of this.table.getBody()) {
      for (const cell of row.getCells()) {
        // a sum row draws the bars and pins of its variances with sumBars, else none
        if (row.type === TableRowType.SUM && !(this.sumBars && cell.direction !== undefined)) continue;
        // waterfall cells scale independently
        if (!cell.isBarChart || !cell.columnStats || cell.waterfall !== undefined) continue;
        if (typeof cell.value !== "number" || isNaN(cell.value)) continue;
        cellsByKey.set(cell.key, [...(cellsByKey.get(cell.key) ?? []), { cell, bold: isBoldRow(row) }]);
      }
    }

    const emPx = this.emPx();
    const fs = emPx * BAR_LABEL_FONT_RATIO;
    const headSize = PIN_HEAD_SIZE * this.scaleFactor;
    const locale = this.stores?.context?.state?.locale;
    const fontFamily = this.labelFontFamily();
    for (const [key, cells] of cellsByKey) {
      const isRelative = key.startsWith("dr");
      const values = cells.map(({ cell }) => cell.value as number);
      const measure = (percentDigits: number, percentSign: boolean): SideLabels => {
        const labels: SideLabels = {
          neg: values.some((value) => value < 0) ? 0 : undefined,
          pos: values.some((value) => value > 0) ? 0 : undefined,
        };
        const zeroPositive = zeroOnPositiveSide(labels);
        for (const { cell, bold } of cells) {
          const value = cell.value as number;
          const side = value > 0 || (value === 0 && zeroPositive) ? "pos" : "neg";
          const text = formatValue(
            value,
            isRelative,
            barLabelMeasureScale(cell),
            locale,
            percentDigits,
            percentSign,
            barLabelDigits(cell, this.componentDataFormatDigits),
          );
          labels[side] = Math.max(
            labels[side] ?? 0,
            labelWidth(text, fs, fontFamily, isRelative && this.relativeItalic(), bold),
          );
        }
        return labels;
      };

      // a narrow pin column drops percent digits, then the %, so every label keeps its sign
      let percentDigits = Math.min(20, Math.max(0, Math.trunc(this.componentDataFormatDigits.percent) || 0));
      let percentSign = this.componentDataFormatDigits.percentSign !== false;
      let labels = measure(percentDigits, percentSign);
      while (isRelative && (percentDigits > 0 || percentSign)) {
        if (pinLabelsFit(this.barWidthOf(key), emPx, labels, headSize)) break;
        if (percentDigits > 0) percentDigits--;
        else percentSign = false;
        labels = measure(percentDigits, percentSign);
      }

      const absMax = Math.max(...values.map(Math.abs)) * (isRelative ? 100 : 1);
      const sideMax: SideLabels = {
        neg: labels.neg === undefined ? undefined : Math.max(0, ...values.map((value) => -value)),
        pos: labels.pos === undefined ? undefined : Math.max(0, ...values),
      };
      layouts.set(key, { isRelative, absMax, labels, sideMax, percentDigits, percentSign });
    }
    return layouts;
  }

  /**
   * What a variance waterfall connector crosses outside the bar svg: the border of its own
   * row above, the padding of a sum row below.
   */
  private connectorReach(row: TableRow): { top: number; bottom: number } {
    const emPx = this.emPx();
    // tr.sum td { padding-bottom }, larger in a grouped list
    const sumPadding = this.groupedList() ? 1 : 0.5;
    return { top: 0.1 * emPx + this.rowGap, bottom: row.type === TableRowType.SUM ? sumPadding * emPx : 0 };
  }

  /**
   * How far the axis of a bar cell runs out of its svg: up through the gap of `fillHeight`,
   * down through the padding of a sum row. Without a gap and on other rows it stays in the svg.
   */
  private axisReach(row: TableRow): { top: number; bottom: number } {
    if (this.rowGap <= 0) return { top: 0, bottom: 0 };
    const reach = this.connectorReach(row);
    return { top: reach.top, bottom: reach.bottom };
  }

  /**
   * Geometry of every waterfall column from the measured labels of all cells that draw a
   * bar, sum rows included: each side gets the room its labels need.
   */
  private collectWaterfallGeometries(): Map<string, WaterfallGeometry> {
    const geometries = new Map<string, WaterfallGeometry>();
    this.waterfallColumns = new Map();
    if (!this.table || this.table.hasNoData()) return geometries;

    const emPx = this.emPx();
    const fs = emPx * BAR_LABEL_FONT_RATIO;
    const locale = this.stores?.context?.state?.locale;
    const fontFamily = this.labelFontFamily();
    const columns = new Map<string, WaterfallColumnLabels>();
    for (const row of this.table.getBody()) {
      for (const cell of row.getCells()) {
        if (!cell.isBarChart || !cell.columnStats || cell.waterfall === undefined) continue;
        if (typeof cell.value !== "number" || isNaN(cell.value)) continue;
        const { start, end, min, max, kind } = cell.waterfall;
        const text = waterfallLabelText(
          cell.value,
          kind,
          barLabelMeasureScale(cell),
          locale,
          barLabelDigits(cell, this.componentDataFormatDigits),
          cell.direction !== undefined,
        );
        const column = columns.get(cell.key) ?? { min, max, labels: [] };
        column.labels.push({
          end,
          pointsLeft: end < start,
          width: labelWidth(text, fs, fontFamily, false, isBoldRow(row)),
        });
        columns.set(cell.key, column);
      }
    }
    for (const [key, column] of columns) {
      geometries.set(key, waterfallGeometry(this.barWidthOf(key), emPx, column));
    }
    this.waterfallColumns = columns;
    return geometries;
  }
}

/** Sum rows and the parent of thereof rows printed above it are bold. */
function isBoldRow(row: TableRow): boolean {
  return row.type === TableRowType.SUM || row.cssStyle === "ofit-sum";
}

/** Percentage points: the fraction times 100, no measure scale. */
function barLabelMeasureScale(cell: Cell): number {
  return cell.type === "percentpoint" ? 0.01 : cell.measureScale;
}

/** Fraction digits of the number cells of the column, so an absolute bar label prints like them. */
function barLabelDigits(cell: Cell, digits: DataFormatDigits): number | undefined {
  if (cell.type === "percentpoint") return digits.percent;
  return cell.type === "decimal" ? digits.decimal : undefined;
}
