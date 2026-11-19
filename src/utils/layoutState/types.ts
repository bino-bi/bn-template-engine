/**
 * JSON schema for the `getLayoutState()` API.
 *
 * A layout state is a lazily generated, JSON-serializable snapshot of a
 * rendered report: where components sit, how big they are, the geometry of
 * their inner elements (bars, labels, axes, cells, ...) and render metadata
 * (counts, scenarios, applied scaling). Consumers are debugging tools,
 * embedding hosts (overlays) and AI agents.
 *
 * All coordinates are CSS pixels, rounded to two decimals. Every rect is
 * expressed in two coordinate spaces at once (see {@link DualRect}).
 */

export const LAYOUT_STATE_VERSION = 1;

export interface LayoutStateOptions {
  /**
   * "summary" (default): component box + regions + metadata + diagnostics.
   * "full": additionally lists per-element geometry (every bar, label,
   * axis, table cell, tree node/edge, grid cell).
   */
  detail?: "summary" | "full";
}

/** Axis-aligned box in CSS px. */
export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The same box expressed in both coordinate spaces. */
export interface DualRect {
  /** Offset from the `bn-context` host's top-left corner. */
  context: LayoutRect;
  /** Offset from the owning component host's top-left corner. */
  component: LayoutRect;
}

export interface EmContext {
  /** Effective font size in px (including any auto-fit scale). */
  fontSizePx: number;
  /** Font auto-fit scale factor applied by the component (1 = none). */
  appliedScaleFactor: number;
}

/** Mirrors `ErrorItem` from `src/utils/withHasError.tsx`. */
export interface LayoutDiagnosticItem {
  id?: string;
  type: "error" | "warning";
  message: string;
  description?: string;
}

/** Resolved value scaling of a chart, including auto-fit results. */
export interface ScalingInfo {
  /** Effective px per data unit. */
  unitPxPerUnit?: number;
  /** Effective px per percentage point. */
  percentagePxPerPoint?: number;
  /** Attribute-form equivalent: data units per em. */
  unitsPerEm?: number;
  /** Attribute-form equivalent: percentage points per em. */
  percentagePointsPerEm?: number;
  unitMode?: "fixed" | "auto";
  percentageMode?: "fixed" | "auto";
}

/**
 * Which data row a rendered element shows. Values are the raw dataset values
 * (not formatted labels), dates are `YYYY-MM-DD`. Only the known fields are set.
 */
export interface DataPointKey {
  rowGroup?: string;
  category?: string;
  subCategory?: string;
  date?: string;
  /** A slot like `ac1`, a variance like `dac1_pl1_pos`, a table column key. */
  scenario?: string;
  /** Set on the subtotal and total rows of a table. */
  row?: "subtotal" | "total";
}

/** `element`: the bar, mark or cell. `label`: its value label. `total`: the total label of a stack. */
export type DataPointPart = "element" | "label" | "total";

/** The key of a data-point element, read from its `data-bn-*` attributes. */
export interface LayoutPoint extends DataPointKey {
  part: DataPointPart;
}

/** Named sub-area of a component, e.g. "canvas:base", "header", "grid". */
export interface LayoutRegion {
  id: string;
  rect: DualRect;
}

interface LayoutElementBase {
  /** DOM id when the rendered element carries one (e.g. "3_RECT"). */
  id?: string;
  rect: DualRect;
}

export interface BarElement extends LayoutElementBase {
  kind: "bar";
  /** "base" or the variance name of the chart segment the bar belongs to. */
  segment: string;
  /** Scenario layer within the segment ("scenario1".."scenario4", "stack:<key>", ...). */
  scenario?: string;
  /** Ordinal of the bar's category within the segment. */
  index: number;
  point?: LayoutPoint;
  /** The value the bar stands for, when the chart writes it (`data-bn-value`). */
  value?: number;
}

export interface LabelElement extends LayoutElementBase {
  kind: "label";
  role: "data" | "scenario" | "category" | "axisLabel" | "title" | "footer" | "legend" | "operator";
  text: string;
  segment?: string;
  index?: number;
  point?: LayoutPoint;
}

export interface AxisElement extends LayoutElementBase {
  kind: "axis";
  /** Scenario style of the axis line: "ac" | "pp" | "fc" | "pl" | "default". */
  style?: string;
  orientation: "horizontal" | "vertical";
  segment?: string;
}

/** Scatter/bubble mark. */
export interface PointElement extends LayoutElementBase {
  kind: "point";
  series?: string;
  index: number;
  text?: string;
  point?: LayoutPoint;
}

export interface CellBarInfo {
  variant: "absolute" | "relative" | "waterfall";
  /** Box of the in-cell bar SVG. */
  rect: DualRect;
}

export interface CellElement extends LayoutElementBase {
  kind: "cell" | "headerCell";
  /** Row index within its section (header and body counted separately). */
  row: number;
  /** Column ordinal within the row. */
  column: number;
  /** Column identity (scenario/attribute alias) when known from the model. */
  key?: string;
  colSpan: number;
  /** Raw model value of the cell. */
  value?: string | number;
  /** Rendered text content. */
  text?: string;
  /** Cell/row type from the model (e.g. "SUM", "GROUPHEAD", "decimal"). */
  type?: string;
  /** Present when the cell hosts a bar/waterfall SVG. */
  bar?: CellBarInfo;
  point?: LayoutPoint;
  /** Box of what the cell shows, without its free space. Set on cells with a `point`. */
  content?: DualRect;
  /** Width in layout px of a sign drawn in front of `content` (the "+" of a variance), which the box leaves out. */
  contentSign?: number;
}

export interface NodeElement extends LayoutElementBase {
  kind: "node";
  /** Node id (= slot name) from the tree configuration. */
  nodeId: string;
}

export interface EdgeElement extends LayoutElementBase {
  kind: "edge";
  from: string;
  to: string;
  operator?: string;
  /** SVG path data of the edge. */
  path?: string;
}

export interface GridCellElement extends LayoutElementBase {
  kind: "gridCell" | "gridHeader" | "gridTitle" | "gridCaption";
  rowId?: string;
  columnId?: string;
  /** Slot name for data cells. */
  slot?: string;
  /** Rows and columns a data cell covers, when more than one. */
  rowSpan?: number;
  columnSpan?: number;
  /** Header, title or caption text. */
  label?: string;
}

export type LayoutElement =
  | BarElement
  | LabelElement
  | AxisElement
  | PointElement
  | CellElement
  | NodeElement
  | EdgeElement
  | GridCellElement;

export interface TableRowInfo {
  section: "header" | "body";
  index: number;
  /** TableRowType name (e.g. "HEADER", "SUM", "STANDARD"). */
  type: string;
  rect: DualRect;
  point?: LayoutPoint;
}

export interface TableColumnInfo {
  index: number;
  key: string;
  group?: string;
  type?: string;
  bucket?: string;
}

export interface TableDetail {
  rows: TableRowInfo[];
  columns: TableColumnInfo[];
}

export interface ComponentMetadata {
  title?: string;
  scenarios?: string[];
  variances?: string[];
  /** Charts: number of categories in the base segment. */
  barCount?: number;
  /** Scatter/bubble: number of rendered marks. */
  pointCount?: number;
  rowCount?: number;
  columnCount?: number;
  headerRowCount?: number;
  cellCount?: number;
  nodeCount?: number;
  edgeCount?: number;
  chartMode?: string;
  dateInterval?: string;
  measureUnit?: string;
  measureScale?: string;
  hasNoData?: boolean;
}

/**
 * The line a component wants to be aligned on, in CSS px from the component
 * host's top-left corner. A missing coordinate means no baseline on that axis.
 */
export interface Baseline {
  x?: number;
  y?: number;
}

export interface ComponentLayoutState {
  version: typeof LAYOUT_STATE_VERSION;
  tag: string;
  /** `id` attr > `name` attr > generated `tag[index]` (assigned by bn-context). */
  id: string;
  /** The component's `slot` attribute when placed in a bn-grid/bn-tree slot. */
  slot?: string;
  rect: DualRect;
  em: EmContext;
  regions: LayoutRegion[];
  metadata: ComponentMetadata;
  /** Parsed `has-error` items of the component. */
  diagnostics: LayoutDiagnosticItem[];
  scaling?: ScalingInfo;
  /** Charts and bn-table: see their `getBaseline()`. */
  baseline?: Baseline;
  /** Present only with `detail: "full"` on rich components. */
  elements?: LayoutElement[];
  /** Present only with `detail: "full"` on bn-table. */
  table?: TableDetail;
  /** Set when collecting this component's state threw; box/identity are still filled. */
  error?: string;
}

export interface LayoutState {
  version: typeof LAYOUT_STATE_VERSION;
  /** ISO 8601 timestamp of the snapshot. */
  generatedAt: string;
  detail: "summary" | "full";
  context: {
    /** Viewport-relative box of the bn-context host at capture time. */
    viewport: LayoutRect;
    locale?: string;
  };
  components: ComponentLayoutState[];
}
