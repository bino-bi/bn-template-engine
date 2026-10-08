import { Component, Element, h, Host, Method, Prop, State, Watch } from "@stencil/core";
import {
  ComponentLayoutState,
  GridCellElement,
  LayoutElement,
  LayoutStateOptions,
  LAYOUT_STATE_VERSION,
  measure,
  originsFor,
  readDiagnostics,
  resolveStandaloneId,
} from "../../utils/layoutState";
import withComponentStatus from "../../utils/withComponentStatus";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { Style, GridStyle } from "../../stores/componentStyles";
import { GridConfig, parseGridConfig, getSlotName, validateHeadersJson } from "./utils/GridConfig";

/**
 * CSS Grid layout container with optional row/column headers.
 *
 * Child components are placed into named slots (`row-col` convention).
 * Supports configurable borders, title, and header visibility.
 */
@Component({
  tag: "bn-grid",
  styleUrl: "bn-grid.scss",
  shadow: true,
})
export class Grid {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  @State() private gridConfig: GridConfig = { rows: [], columns: [] };

  private readonly errors: ErrorDispatcher;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;

  /**
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its values go on top of the default style.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  /**
   * Title displayed at top-left of the grid.
   */
  @Prop({ attribute: "chart-title" }) chartTitle: string = "";

  /**
   * JSON array defining row headers.
   * Simple format: '["Row 1", "Row 2"]'
   * With IDs: '[{"label": "Row 1", "id": "r1"}, {"label": "Row 2", "id": "r2"}]'
   */
  @Prop({ attribute: "row-headers" }) rowHeaders: string = "[]";

  @Watch("rowHeaders")
  validateRowHeaders(newValue: string) {
    const errId = "ERR_rowHeaders";
    const validationErrors = validateHeadersJson(newValue);

    if (validationErrors.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "error",
        message: `row-headers: ${validationErrors.join("; ")}`,
      });
    } else {
      this.errors.remove(errId);
    }

    this.updateGridConfig();
  }

  /**
   * JSON array defining column headers.
   * Simple format: '["Column 1", "Column 2"]'
   * With IDs: '[{"label": "Column 1", "id": "c1"}, {"label": "Column 2", "id": "c2"}]'
   */
  @Prop({ attribute: "column-headers" }) columnHeaders: string = "[]";

  @Watch("columnHeaders")
  validateColumnHeaders(newValue: string) {
    const errId = "ERR_columnHeaders";
    const validationErrors = validateHeadersJson(newValue);

    if (validationErrors.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "error",
        message: `column-headers: ${validationErrors.join("; ")}`,
      });
    } else {
      this.errors.remove(errId);
    }

    this.updateGridConfig();
  }

  /**
   * Whether to display row headers.
   */
  @Prop({ attribute: "show-row-headers" }) showRowHeaders: boolean = true;

  /**
   * Whether to display column headers.
   */
  @Prop({ attribute: "show-column-headers" }) showColumnHeaders: boolean = true;

  /**
   * I18n namespace inherited by this grid's children (their own namespace
   * wins). Resolved at runtime from the `i18n-namespace` attribute by the
   * nearest ancestor lookup in `withTranslation`; the grid renders no
   * translated text itself. Declared so the attribute is part of the typed
   * public API rather than a bare DOM attribute.
   */
  @Prop({ reflect: true, attribute: "i18n-namespace" }) i18nNamespace: string;

  /**
   * Whether to display divider lines between cells.
   */
  @Prop({ attribute: "show-borders" }) showBorders: boolean = true;

  /**
   * Width of row header column. Accepts CSS values (e.g., 'auto', '100px', '20%').
   */
  @Prop({ attribute: "row-header-width" }) rowHeaderWidth: string = "auto";

  /**
   * Gap between cells. Accepts CSS values (e.g., '0px', '8px').
   */
  @Prop({ attribute: "cell-gap" }) cellGap: string = "0px";

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  /**
   * Lazily generates this grid's layout state: host box (context- and
   * component-relative, CSS px), the grid region and row/column counts. With
   * `detail: "full"` the title, every header and every data cell (with its
   * slot name) is listed with its geometry.
   *
   * @param options - `{ detail: "summary" | "full" }`, default `"summary"`
   */
  @Method()
  async getLayoutState(options?: LayoutStateOptions): Promise<ComponentLayoutState> {
    const detail = options?.detail ?? "summary";
    const origins = originsFor(this.element);
    const fontSizePx = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);
    const { rows, columns } = this.gridConfig;

    const state: ComponentLayoutState = {
      version: LAYOUT_STATE_VERSION,
      tag: this.element.localName,
      id: resolveStandaloneId(this.element),
      slot: this.element.getAttribute("slot") ?? undefined,
      rect: measure(this.element, origins),
      em: { fontSizePx, appliedScaleFactor: 1 },
      regions: [],
      metadata: {
        title: this.chartTitle || undefined,
        rowCount: rows.length,
        columnCount: columns.length,
        cellCount: rows.length * columns.length,
      },
      diagnostics: readDiagnostics(this.element),
    };

    const container = this.element.shadowRoot?.querySelector(".grid-container");
    if (container) state.regions.push({ id: "grid", rect: measure(container, origins) });

    if (detail !== "full" || !container) {
      return state;
    }

    const elements: LayoutElement[] = [];
    const push = (entry: GridCellElement) => elements.push(entry);

    const title = container.querySelector(".grid-title");
    if (title) {
      push({ kind: "gridTitle", label: title.textContent?.trim() || undefined, rect: measure(title, origins) });
    }
    container.querySelectorAll(".grid-header-col").forEach((header, index) => {
      push({
        kind: "gridHeader",
        columnId: columns[index]?.id,
        label: header.textContent?.trim() || undefined,
        rect: measure(header, origins),
      });
    });
    container.querySelectorAll(".grid-header-row").forEach((header, index) => {
      push({
        kind: "gridHeader",
        rowId: rows[index]?.id,
        label: header.textContent?.trim() || undefined,
        rect: measure(header, origins),
      });
    });
    // Data cells render row-major (see renderDataCells), so index i maps to
    // row i / columns.length, column i % columns.length.
    container.querySelectorAll(".grid-cell").forEach((cell, index) => {
      push({
        kind: "gridCell",
        rowId: columns.length > 0 ? rows[Math.floor(index / columns.length)]?.id : undefined,
        columnId: columns.length > 0 ? columns[index % columns.length]?.id : undefined,
        slot: cell.querySelector("slot")?.getAttribute("name") ?? undefined,
        rect: measure(cell, origins),
      });
    });

    state.elements = elements;
    return state;
  }

  /**
   * Get grid styles from component style store
   */
  private getGridStyle(): GridStyle {
    return this.componentStyle(($) => $["bn-grid"]);
  }

  componentWillLoad() {
    this.validateRowHeaders(this.rowHeaders);
    this.validateColumnHeaders(this.columnHeaders);
  }

  private updateGridConfig() {
    this.gridConfig = parseGridConfig(this.rowHeaders, this.columnHeaders);
  }

  private shouldShowRowHeaders(): boolean {
    return this.showRowHeaders && this.gridConfig.rows.length > 0;
  }

  private shouldShowColumnHeaders(): boolean {
    return this.showColumnHeaders && this.gridConfig.columns.length > 0;
  }

  private shouldShowBorders(): boolean {
    return this.showBorders;
  }

  private getGridTemplateColumns(): string {
    const cols: string[] = [];

    if (this.shouldShowRowHeaders()) {
      cols.push(this.rowHeaderWidth);
    }

    // Add columns for each data column (auto-size to content)
    const numCols = this.gridConfig.columns.length || 1;
    for (let i = 0; i < numCols; i++) {
      cols.push("auto");
    }

    return cols.join(" ");
  }

  private getGridTemplateRows(): string {
    const rows: string[] = [];

    // Title row (if title exists)
    if (this.chartTitle) {
      rows.push("auto");
    }

    // Column headers row
    if (this.shouldShowColumnHeaders()) {
      rows.push("auto");
    }

    // Add rows for each data row (auto-size to content)
    const numRows = this.gridConfig.rows.length || 1;
    for (let i = 0; i < numRows; i++) {
      rows.push("auto");
    }

    return rows.join(" ");
  }

  private renderTitle() {
    if (!this.chartTitle) {
      return null;
    }

    const totalCols = (this.shouldShowRowHeaders() ? 1 : 0) + this.gridConfig.columns.length;

    return (
      <div
        class="grid-title"
        style={{
          "grid-column": `1 / span ${totalCols}`,
          "grid-row": "1",
        }}
      >
        {this.chartTitle}
      </div>
    );
  }

  private renderColumnHeaders() {
    if (!this.shouldShowColumnHeaders()) {
      return null;
    }

    const style = this.getGridStyle();
    const borderStyle = this.shouldShowBorders() ? `${style.borderWidth}px solid ${style.borderColor}` : "none";
    const startCol = this.shouldShowRowHeaders() ? 2 : 1;
    const headerRow = this.chartTitle ? 2 : 1;

    return this.gridConfig.columns.map((col, index) => {
      const isNotFirstCol = index > 0;

      return (
        <div
          key={`col-header-${col.id}`}
          class="grid-header grid-header-col"
          style={{
            "grid-column": String(startCol + index),
            "grid-row": String(headerRow),
            "border-left": isNotFirstCol ? borderStyle : "none",
            padding: `${style.cellPadding}px`,
            "padding-left": isNotFirstCol ? `${style.cellPadding + 4}px` : `${style.cellPadding}px`,
          }}
        >
          {col.label}
        </div>
      );
    });
  }

  private renderDataCells() {
    const style = this.getGridStyle();
    const borderStyle = this.shouldShowBorders() ? `${style.borderWidth}px solid ${style.borderColor}` : "none";
    const startCol = this.shouldShowRowHeaders() ? 2 : 1;
    const startRow = (this.chartTitle ? 1 : 0) + (this.shouldShowColumnHeaders() ? 1 : 0) + 1;

    const cells: HTMLElement[] = [];

    if (this.gridConfig.rows.length > 0 && this.gridConfig.columns.length > 0) {
      this.gridConfig.rows.forEach((row, rowIndex) => {
        // Render row header for this row
        if (this.shouldShowRowHeaders()) {
          const isNotFirstRow = rowIndex > 0;
          cells.push(
            <div
              key={`row-header-${row.id}`}
              class="grid-header grid-header-row"
              style={{
                "grid-column": "1",
                "grid-row": String(startRow + rowIndex),
                "border-top": isNotFirstRow ? borderStyle : "none",
                padding: `${style.cellPadding}px`,
                "padding-top": isNotFirstRow ? `${style.cellPadding + 4}px` : `${style.cellPadding}px`,
              }}
            >
              {row.label}
            </div>,
          );
        }

        // Render data cells for this row
        this.gridConfig.columns.forEach((col, colIndex) => {
          const slotName = getSlotName(row, col);
          const isNotFirstCol = colIndex > 0;
          const isNotFirstRow = rowIndex > 0;

          cells.push(
            <div
              key={`cell-${slotName}`}
              class="grid-cell"
              style={{
                "grid-column": String(startCol + colIndex),
                "grid-row": String(startRow + rowIndex),
                "border-left": isNotFirstCol ? borderStyle : "none",
                "border-top": isNotFirstRow ? borderStyle : "none",
                "padding-left": isNotFirstCol ? `${style.cellPadding + 4}px` : "0",
                "padding-top": isNotFirstRow ? `${style.cellPadding + 4}px` : "0",
              }}
            >
              <slot name={slotName} />
            </div>,
          );
        });
      });
    }

    return cells;
  }

  private getFontStyles(): { [key: string]: string } {
    return this.componentStyle(($) => ({
      "--bn-font-family": $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
      "--bn-font-size": `${$["global"]?.["fontSizePx"] || 13.3333}px`,
      "--bn-font-color": $["global"]?.["fontColor"] || "#000000",
      "--bn-font-background": $["global"]?.["fontBackgroundColor"] || "#ffffff",
    }));
  }

  render() {
    const gridContainerStyle: { [key: string]: string } = {
      display: "inline-grid",
      "grid-template-columns": this.getGridTemplateColumns(),
      "grid-template-rows": this.getGridTemplateRows(),
      gap: this.cellGap,
    };

    return (
      <Host style={this.getFontStyles()}>
        <div class="grid-container" style={gridContainerStyle}>
          {this.renderTitle()}
          {this.renderColumnHeaders()}
          {this.renderDataCells()}
        </div>
        <slot />
      </Host>
    );
  }
}
