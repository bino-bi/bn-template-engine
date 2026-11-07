import { Component, Element, h, Host, Method, Prop, State, Watch } from "@stencil/core";
import {
  Baseline,
  ComponentLayoutState,
  GridCellElement,
  LayoutElement,
  LayoutStateOptions,
  LAYOUT_STATE_VERSION,
  localFrameOf,
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
import {
  ALIGN,
  baselineOffsets,
  BaselineCell,
  CELL_SIZES,
  CellOffset,
  CellSize,
  HORIZONTAL_ALIGNS,
  HorizontalAlign,
  JUSTIFY,
  parseCaptions,
  sameOffsets,
  VERTICAL_ALIGNS,
  VerticalAlign,
} from "./utils/cellLayout";

/** A component that can say where it wants to be aligned. */
interface AlignableElement extends HTMLElement {
  componentOnReady?: () => Promise<unknown>;
  getBaseline?: () => Promise<Baseline>;
}

/** Elements in a slot that show nothing, so they are not what a cell aligns on. */
const CONFIG_ELEMENTS = new Set([
  "bn-asset",
  "bn-component-style",
  "bn-dataset",
  "bn-datasource",
  "bn-internationalization",
  "bn-ruleset",
  "bn-scaling-group",
]);

/** A pass that keeps changing the offsets stops after this many: a component whose baseline follows its width could chase it. */
const MAX_ADJUSTMENTS = 5;

/**
 * CSS Grid layout container with optional row/column headers.
 *
 * Child components are placed into named slots (`row-col` convention).
 * Supports configurable borders, title, and header visibility. Cells can
 * have equal sizes, a caption, and aligned content; `baseline` lines up the
 * axes of charts (and the header of tables) in a row or column.
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
  @State() private resolvedHeight: CellSize = "auto";
  @State() private resolvedWidth: CellSize = "auto";
  @State() private resolvedVertical: VerticalAlign = "top";
  @State() private resolvedHorizontal: HorizontalAlign = "left";
  @State() private captions: Record<string, string> = {};
  /** Per slot: how far the baseline pass moved the content. */
  @State() private offsets: Record<string, CellOffset> = {};

  private readonly errors: ErrorDispatcher;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  private readonly holdStatus: (work: Promise<unknown>) => void;
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private observed = new WeakSet<Node>();
  private scheduled = false;
  private run = 0;
  private adjustments = 0;

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

  /**
   * Height of the data rows: `auto` (default) sizes each row to its content,
   * `equal` gives every data row the height of the tallest one.
   */
  @Prop({ attribute: "cell-height" }) cellHeight: string = "auto";

  @Watch("cellHeight")
  validateCellHeight(newValue: string) {
    this.resolvedHeight = this.validateChoice("cell-height", "ERR_cellHeight", newValue, CELL_SIZES, "auto");
  }

  /**
   * Width of the data columns: `auto` (default) sizes each column to its
   * content, `equal` gives every data column the width of the widest one.
   */
  @Prop({ attribute: "cell-width" }) cellWidth: string = "auto";

  @Watch("cellWidth")
  validateCellWidth(newValue: string) {
    this.resolvedWidth = this.validateChoice("cell-width", "ERR_cellWidth", newValue, CELL_SIZES, "auto");
  }

  /**
   * Vertical position of the content in a cell: `top` (default), `center`,
   * `bottom`, or `baseline`. `baseline` lines up the components of a row on
   * their baseline (the axis of a chart, the bottom of a table header); a
   * component without one goes to the bottom.
   */
  @Prop({ attribute: "cell-vertical-align" }) cellVerticalAlign: string = "top";

  @Watch("cellVerticalAlign")
  validateCellVerticalAlign(newValue: string) {
    this.resolvedVertical = this.validateChoice(
      "cell-vertical-align",
      "ERR_cellVerticalAlign",
      newValue,
      VERTICAL_ALIGNS,
      "top",
    );
    this.schedule();
  }

  /**
   * Horizontal position of the content in a cell: `left` (default),
   * `center`, `right`, or `baseline`. `baseline` lines up the components of
   * a column on their baseline (the vertical axis of a chart, the first value
   * column of a table); a component without one stays left.
   */
  @Prop({ attribute: "cell-horizontal-align" }) cellHorizontalAlign: string = "left";

  @Watch("cellHorizontalAlign")
  validateCellHorizontalAlign(newValue: string) {
    this.resolvedHorizontal = this.validateChoice(
      "cell-horizontal-align",
      "ERR_cellHorizontalAlign",
      newValue,
      HORIZONTAL_ALIGNS,
      "left",
    );
    this.schedule();
  }

  /**
   * JSON object from slot name to a caption, drawn top left in the cell above
   * its content: '{"0-0": "Berlin", "0-1": "Cologne"}'. Alignment moves the
   * content, never the caption. The style section `bn-grid` sets its font.
   */
  @Prop({ attribute: "cell-captions" }) cellCaptions: string = "";

  @Watch("cellCaptions")
  validateCellCaptions(newValue: string) {
    const captions = parseCaptions(newValue);
    if (captions) {
      this.errors.remove("ERR_cellCaptions");
    } else {
      this.errors.addOrReplace({
        id: "ERR_cellCaptions",
        type: "error",
        message: "cell-captions: not a JSON object from slot name to text.",
      });
    }
    this.captions = captions ?? {};
  }

  constructor() {
    withStyled(this);
    this.holdStatus = withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  connectedCallback() {
    this.observed = new WeakSet();
    this.resizeObserver = new ResizeObserver(this.schedule);
    // a child can be added, moved to another slot or replaced, in a morphing preview for example
    this.mutationObserver = new MutationObserver(this.schedule);
    this.mutationObserver.observe(this.element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["slot"],
    });
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.run++;
  }

  componentDidLoad() {
    this.schedule();
  }

  private validateChoice<T extends string>(
    attribute: string,
    errId: `ERR_${string}`,
    value: string,
    allowed: readonly T[],
    fallback: T,
  ): T {
    if (value === undefined || value === null || value === "") {
      this.errors.remove(errId);
      return fallback;
    }
    if ((allowed as readonly string[]).includes(value)) {
      this.errors.remove(errId);
      return value as T;
    }
    this.errors.addOrReplace({
      id: errId,
      type: "error",
      message: `${attribute}: "${value}" is not one of ${allowed.join(", ")}.`,
    });
    return fallback;
  }

  private isBaselineMode(): boolean {
    return this.resolvedVertical === "baseline" || this.resolvedHorizontal === "baseline";
  }

  /**
   * Aligns the baselines after the next paint. The grid counts as working
   * until then, so a printer does not print a half-aligned grid.
   */
  private readonly schedule = () => {
    if (this.scheduled) return;
    if (!this.isBaselineMode()) {
      if (Object.keys(this.offsets).length > 0) this.offsets = {};
      return;
    }
    this.scheduled = true;
    this.holdStatus(
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          this.scheduled = false;
          this.align()
            .catch((e) => console.error("bn-grid: aligning the baselines failed", e))
            .finally(resolve);
        });
      }),
    );
  };

  /** The first visual component in a slot, or the slotted element itself. */
  private visualIn(slot: string): AlignableElement | undefined {
    const slotted = Array.from(this.element.children).find((child) => child.getAttribute("slot") === slot);
    if (!slotted) return undefined;
    const isVisual = (el: Element) => el.localName.startsWith("bn-") && !CONFIG_ELEMENTS.has(el.localName);
    if (isVisual(slotted)) return slotted as AlignableElement;
    return (Array.from(slotted.querySelectorAll("*")).find(isVisual) as AlignableElement) ?? undefined;
  }

  private async align(): Promise<void> {
    const run = ++this.run;
    if (!this.element.isConnected || !this.isBaselineMode()) return;

    const { rows, columns } = this.gridConfig;
    const slots = rows.flatMap((row, rowIndex) =>
      columns.map((column, columnIndex) => ({ slot: getSlotName(row, column), row: rowIndex, column: columnIndex })),
    );
    const visuals = slots.map(({ slot }) => this.visualIn(slot));
    await Promise.all(visuals.map((visual) => visual?.componentOnReady?.()));
    if (run !== this.run) return;
    visuals.forEach((visual) => visual && this.observe(visual));

    const baselines = await Promise.all(
      visuals.map((visual) =>
        typeof visual?.getBaseline === "function" ? visual.getBaseline().catch(() => ({})) : Promise.resolve({}),
      ),
    );
    if (run !== this.run) return;

    const frame = localFrameOf(this.element);
    const cells: BaselineCell[] = slots.map(({ slot, row, column }, index) => {
      const visual = visuals[index];
      const baseline: Baseline = baselines[index];
      // what is drawn now, not what is in the state: a render can still be pending
      const wrapper = this.element.shadowRoot?.querySelector<HTMLElement>(`.grid-slot[data-slot="${slot}"]`);
      const applied = (side: string) => parseFloat(wrapper?.style.getPropertyValue(`padding-${side}`) || "0") || 0;
      const cell: BaselineCell = { slot, row, column, top: applied("top"), left: applied("left") };
      if (visual) {
        const box = frame.toLocal(visual.getBoundingClientRect());
        if (baseline.y !== undefined) cell.y = box.y + baseline.y;
        if (baseline.x !== undefined) cell.x = box.x + baseline.x;
      }
      return cell;
    });

    const next = baselineOffsets(cells, this.resolvedVertical === "baseline", this.resolvedHorizontal === "baseline");
    if (sameOffsets(next, this.offsets)) {
      this.adjustments = 0;
      return;
    }
    if (this.adjustments >= MAX_ADJUSTMENTS) {
      console.warn("bn-grid: the baselines did not settle; the cells keep their last alignment.");
      return;
    }
    this.adjustments++;
    this.offsets = next;
    // check once more after the new offsets are drawn; the status stays held until then
    this.schedule();
  }

  /** A chart redraws inside its shadow roots, where the host and a mutation observer on it see nothing. */
  private observe(visual: Element) {
    if (!this.observed.has(visual)) {
      this.observed.add(visual);
      this.resizeObserver?.observe(visual);
    }
    const walk = (root: ShadowRoot | null | undefined) => {
      if (!root) return;
      if (!this.observed.has(root)) {
        this.observed.add(root);
        this.mutationObserver?.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["x1", "y1", "x2", "y2", "x", "y", "width", "height", "transform", "style", "class"],
        });
      }
      root.querySelectorAll("*").forEach((el) => walk(el.shadowRoot));
    };
    walk(visual.shadowRoot);
  }

  /**
   * Lazily generates this grid's layout state: host box (context- and
   * component-relative, CSS px), the grid region and row/column counts. With
   * `detail: "full"` the title, every header, every data cell and every
   * caption (with its slot name) is listed with its geometry.
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
    container.querySelectorAll(".grid-caption").forEach((caption) => {
      push({
        kind: "gridCaption",
        slot: caption.parentElement?.querySelector("slot")?.getAttribute("name") ?? undefined,
        label: caption.textContent?.trim() || undefined,
        rect: measure(caption, origins),
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
    this.validateCellHeight(this.cellHeight);
    this.validateCellWidth(this.cellWidth);
    this.validateCellVerticalAlign(this.cellVerticalAlign);
    this.validateCellHorizontalAlign(this.cellHorizontalAlign);
    this.validateCellCaptions(this.cellCaptions);
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

    // Add columns for each data column: auto-size to content, or all as wide as the widest
    const numCols = this.gridConfig.columns.length || 1;
    for (let i = 0; i < numCols; i++) {
      cols.push(this.resolvedWidth === "equal" ? "1fr" : "auto");
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

    // Add rows for each data row: auto-size to content, or all as high as the highest
    const numRows = this.gridConfig.rows.length || 1;
    for (let i = 0; i < numRows; i++) {
      rows.push(this.resolvedHeight === "equal" ? "1fr" : "auto");
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
                ...this.cellAlignStyle(),
              }}
            >
              {this.renderCellContent(slotName, style)}
            </div>,
          );
        });
      });
    }

    return cells;
  }

  /** Flex column only when the content is not at the default top left: a block cell stays a block. */
  private cellAlignStyle(): { [key: string]: string } {
    if (this.resolvedVertical === "top" && this.resolvedHorizontal === "left") return {};
    return {
      display: "flex",
      "flex-direction": "column",
      "justify-content": JUSTIFY[this.resolvedVertical],
      "align-items": ALIGN[this.resolvedHorizontal],
    };
  }

  /**
   * The caption, then the slot. With a caption or a baseline the slot gets a
   * wrapper: auto margins move it below the caption (the caption stays at the
   * top), and padding moves it onto the baseline.
   */
  private renderCellContent(slotName: string, style: GridStyle) {
    const text = this.captions[slotName];
    const caption =
      text !== undefined ? (
        <div
          class="grid-caption"
          style={{
            "font-size": `${style.captionFontSize}px`,
            "font-weight": String(style.captionFontWeight),
            color: style.captionColor,
            "margin-bottom": `${style.captionGap}px`,
            "align-self": "flex-start",
          }}
        >
          {text}
        </div>
      ) : null;

    const baseline = this.isBaselineMode();
    if (!baseline && (caption === null || this.resolvedVertical === "top")) {
      return [caption, <slot name={slotName} />];
    }

    const wrapper: { [key: string]: string } = {};
    if (this.resolvedVertical === "center") {
      wrapper["margin-top"] = "auto";
      wrapper["margin-bottom"] = "auto";
    } else if (this.resolvedVertical === "bottom") {
      wrapper["margin-top"] = "auto";
    }
    const offset = this.offsets[slotName];
    if (offset?.bottom) wrapper["margin-top"] = "auto";
    if (offset?.top) wrapper["padding-top"] = `${offset.top}px`;
    if (offset?.left) wrapper["padding-left"] = `${offset.left}px`;

    return [
      caption,
      <div class="grid-slot" data-slot={slotName} style={wrapper}>
        <slot name={slotName} />
      </div>,
    ];
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
