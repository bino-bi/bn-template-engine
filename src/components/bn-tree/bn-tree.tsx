import { Component, Element, h, Host, Method, Prop, State, Watch } from "@stencil/core";
import { isValidNumber } from "../../utils/validate";
import {
  ComponentLayoutState,
  EdgeElement,
  LabelElement,
  LayoutElement,
  LayoutStateOptions,
  LAYOUT_STATE_VERSION,
  NodeElement,
  measure,
  originsFor,
  readDiagnostics,
  resolveStandaloneId,
} from "../../utils/layoutState";
import withComponentStatus from "../../utils/withComponentStatus";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { Style } from "../../stores/componentStyles";
import { getClippedHeight, getParentDimensions } from "../../utils/parentDimensions";
import { LayoutObserverHandle, observeParentResize } from "../../utils/layoutObserver";

import { TreeConfig, parseTreeConfig, validateEdges, getOperatorSymbol, getEdgeForChild } from "./utils/TreeParser";

import {
  LayoutDirection,
  LayoutResult,
  calculateLayout,
  getActualGridColumn,
  getActualGridColumnSpan,
  getActualGridRow,
  getActualGridRowSpan,
} from "./utils/TreeLayout";

import {
  EdgeStyleType,
  NodeRect,
  getNodeRect,
  getConnectionPoint,
  getMultiParentConnectionPoint,
  generateEdgePath,
  calculateBend,
  calculateOperatorPosition,
  getEdgeSvgStyle,
} from "./utils/EdgeRenderer";

/** True when both maps hold the same nodes at the same place with the same size. */
function sameNodeRects(a: Map<string, NodeRect>, b: Map<string, NodeRect>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [nodeId, rect] of a) {
    const other = b.get(nodeId);
    if (
      !other ||
      other.left !== rect.left ||
      other.top !== rect.top ||
      other.width !== rect.width ||
      other.height !== rect.height
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Renders a hierarchical tree diagram with SVG edge connections.
 *
 * Nodes are provided as named slots; the `edges` prop defines parent-child
 * relationships and optional arithmetic operators displayed between siblings.
 * Layout is computed via CSS Grid with an SVG overlay for edge paths.
 */
@Component({
  tag: "bn-tree",
  styleUrl: "bn-tree.scss",
  shadow: true,
})
export class ChartTree {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  @State() private treeConfig: TreeConfig | null = null;
  @State() private layout: LayoutResult | null = null;
  @State() private nodeRects: Map<string, NodeRect> = new Map();
  @State() private svgWidth: number = 0;
  @State() private svgHeight: number = 0;

  private readonly errors: ErrorDispatcher;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  private resizeObserver: ResizeObserver | null = null;
  private gridContainer: HTMLElement | null = null;
  private observed = new Set<Element>();
  private parentObserver: LayoutObserverHandle | null = null;

  /**
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its values go on top of the default style.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  /**
   * JSON string defining connections between nodes.
   * Each edge specifies a source (from) and target (to) node ID,
   * with optional operator and styling.
   *
   * Example:
   * ```json
   * [
   *   {"from":"roi","to":"ros","operator":"x"},
   *   {"from":"roi","to":"capital-turnover"}
   * ]
   * ```
   */
  @Prop() edges!: string;

  @Watch("edges")
  validateEdgesProp(newValue: string) {
    const errId = "ERR_edges";
    const validationErrors = validateEdges(newValue);

    if (validationErrors.length > 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "error",
        message: `edges: ${validationErrors.join("; ")}`,
      });
      this.treeConfig = null;
    } else {
      this.errors.remove(errId);
      this.treeConfig = parseTreeConfig(newValue);
    }

    this.recalculateLayout();
  }

  /**
   * Layout direction of the tree.
   * - 'ltr': left to right (root on left)
   * - 'rtl': right to left (root on right)
   * - 'ttb': top to bottom (root on top)
   * - 'btt': bottom to top (root on bottom)
   */
  @Prop() direction: LayoutDirection = "ltr";

  @Watch("direction")
  validateDirection(newValue: string) {
    const errId = "WARN_direction";
    const validValues = ["ltr", "rtl", "ttb", "btt"];

    if (!validValues.includes(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `direction: invalid value '${newValue}', must be one of: ${validValues.join(", ")}`,
      });
    } else {
      this.errors.remove(errId);
    }

    this.recalculateLayout();
  }

  /**
   * Spacing between hierarchy levels in pixels.
   */
  @Prop({ attribute: "level-spacing" }) levelSpacing: number = 60;

  @Watch("levelSpacing")
  validateLevelSpacing(newValue: number) {
    const errId = "WARN_levelSpacing";

    if (!isValidNumber(newValue) || newValue < 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `level-spacing: invalid value '${newValue}', must be a non-negative number`,
      });
    } else {
      this.errors.remove(errId);
    }

    this.recalculateLayout();
  }

  /**
   * Spacing between sibling nodes in pixels.
   */
  @Prop({ attribute: "node-spacing" }) nodeSpacing: number = 20;

  @Watch("nodeSpacing")
  validateNodeSpacing(newValue: number) {
    const errId = "WARN_nodeSpacing";

    if (!isValidNumber(newValue) || newValue < 0) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `node-spacing: invalid value '${newValue}', must be a non-negative number`,
      });
    } else {
      this.errors.remove(errId);
    }

    this.recalculateLayout();
  }

  /**
   * Edge line style.
   * - 'straight': direct line between nodes
   * - 'orthogonal': right-angle lines (default)
   * - 'curved': smooth bezier curves
   */
  @Prop({ attribute: "edge-style" }) edgeStyle: EdgeStyleType = "orthogonal";

  /**
   * I18n namespace inherited by this tree's children (their own namespace
   * wins). Resolved at runtime from the `i18n-namespace` attribute by the
   * nearest ancestor lookup in `withTranslation`; the tree renders no
   * translated text itself. Declared so the attribute is part of the typed
   * public API rather than a bare DOM attribute.
   */
  @Prop({ reflect: true, attribute: "i18n-namespace" }) i18nNamespace: string;

  @Watch("edgeStyle")
  validateEdgeStyle(newValue: string) {
    const errId = "WARN_edgeStyle";
    const validValues = ["straight", "orthogonal", "curved"];

    if (!validValues.includes(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `edge-style: invalid value '${newValue}', must be one of: ${validValues.join(", ")}`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Show operator labels between sibling nodes.
   */
  @Prop({ attribute: "show-operators" }) showOperators: boolean = true;

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  /**
   * Lazily generates this tree's layout state: host box (context- and
   * component-relative, CSS px), the grid region and node/edge counts. With
   * `detail: "full"` every node (slotted content), edge path and operator is
   * listed with its geometry.
   *
   * @param options - `{ detail: "summary" | "full" }`, default `"summary"`
   */
  @Method()
  async getLayoutState(options?: LayoutStateOptions): Promise<ComponentLayoutState> {
    const detail = options?.detail ?? "summary";
    const origins = originsFor(this.element);
    const fontSizePx = this.componentStyle(($) => $["global"]?.["fontSizePx"] || 13.3333);

    const state: ComponentLayoutState = {
      version: LAYOUT_STATE_VERSION,
      tag: this.element.localName,
      id: resolveStandaloneId(this.element),
      slot: this.element.getAttribute("slot") ?? undefined,
      rect: measure(this.element, origins),
      em: { fontSizePx, appliedScaleFactor: 1 },
      regions: [],
      metadata: {
        nodeCount: this.treeConfig?.allNodes.size ?? 0,
        edgeCount: this.treeConfig?.edges.length ?? 0,
      },
      diagnostics: readDiagnostics(this.element),
    };

    const grid = this.element.shadowRoot?.querySelector(".tree-grid");
    if (grid) state.regions.push({ id: "grid", rect: measure(grid, origins) });

    if (detail !== "full" || !this.treeConfig) {
      return state;
    }

    const elements: LayoutElement[] = [];
    for (const nodeId of this.treeConfig.allNodes) {
      const slotted = this.element.querySelector(`[slot="${nodeId}"]`);
      if (!slotted) continue;
      const node: NodeElement = { kind: "node", nodeId, rect: measure(slotted, origins) };
      elements.push(node);
    }

    // Pair model edges with the rendered paths, replicating renderEdges()'s
    // skip of edges whose node rects are missing.
    const paths = Array.from(this.element.shadowRoot?.querySelectorAll("svg.edge-layer path") ?? []);
    let pathIndex = 0;
    for (const edge of this.treeConfig.edges) {
      if (!this.nodeRects.get(edge.from) || !this.nodeRects.get(edge.to)) continue;
      const pathEl = paths[pathIndex++];
      if (!pathEl) break;
      const edgeElement: EdgeElement = {
        kind: "edge",
        from: edge.from,
        to: edge.to,
        operator: edge.operator,
        path: pathEl.getAttribute("d") ?? undefined,
        rect: measure(pathEl, origins),
      };
      elements.push(edgeElement);
    }

    this.element.shadowRoot?.querySelectorAll("svg.edge-layer g.operator-group").forEach((group) => {
      const text = group.textContent?.trim() ?? "";
      if (!text) return;
      const operator: LabelElement = { kind: "label", role: "operator", text, rect: measure(group, origins) };
      elements.push(operator);
    });

    state.elements = elements;
    return state;
  }

  /**
   * Get tree chart styles from component style store
   */
  private getTreeStyle() {
    return this.componentStyle(($) => {
      const baseFontSize = $["global"].fontSizePx;
      return {
        edgeColor: $["bn-tree"].edgeColor,
        edgeWidth: $["bn-tree"].edgeWidth,
        operatorCircleRadius: $["bn-tree"].operatorCircleRadius,
        operatorFontSize: baseFontSize * $["bn-tree"].operatorFontSizeScale,
        operatorColor: $["bn-tree"].operatorColor,
      };
    });
  }

  componentWillLoad() {
    this.validateEdgesProp(this.edges);
    this.validateDirection(this.direction);
    this.validateLevelSpacing(this.levelSpacing);
    this.validateNodeSpacing(this.nodeSpacing);
    this.validateEdgeStyle(this.edgeStyle);
  }

  connectedCallback() {
    // After a move in the document the observers are gone. Before the first render there is no grid yet.
    this.observeLayout();
    this.updateNodeRects();
  }

  componentDidLoad() {
    // a node that is slotted in later changes no size the tree observes
    this.element.shadowRoot?.addEventListener("slotchange", () => {
      this.observeLayout();
      this.updateNodeRects();
    });

    // Defer DOM measurement to after the browser has completed layout.
    // getBoundingClientRect() can return zeros if called before first paint.
    requestAnimationFrame(() => {
      this.updateNodeRects();
    });
  }

  componentDidRender() {
    // A render can move the nodes without changing their size (direction, spacing, edges),
    // and it can create the grid for the first time. No resize observer fires for that.
    this.observeLayout();
    this.updateNodeRects();
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.observed.clear();
    this.parentObserver?.disconnect();
    this.parentObserver = null;
  }

  /** Looks up the grid of this render and observes it and every node that is not observed yet. */
  private observeLayout() {
    const grid: HTMLElement | null = this.element.shadowRoot?.querySelector(".tree-grid") ?? null;

    if (grid !== this.gridContainer) {
      // the grid is created anew when the tree was invalid in between
      this.resizeObserver?.disconnect();
      this.observed.clear();
      this.gridContainer = grid;
    }

    if (!grid) {
      return;
    }

    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateNodeRects();
      });
    }

    // the space of the tree can change while the tree keeps its size
    if (!this.parentObserver) {
      this.parentObserver = observeParentResize(this.element, () => this.checkOverflow());
    }

    for (const target of [grid, ...Array.from(this.element.querySelectorAll("[slot]"))]) {
      if (!this.observed.has(target)) {
        this.resizeObserver.observe(target);
        this.observed.add(target);
      }
    }
  }

  private recalculateLayout() {
    if (!this.treeConfig) {
      this.layout = null;
      return;
    }

    this.layout = calculateLayout(this.treeConfig, this.direction, this.levelSpacing, this.nodeSpacing);
  }

  private updateNodeRects() {
    if (!this.treeConfig || !this.gridContainer) {
      // no tree is drawn, so nothing is cut off
      this.errors?.remove("WARN_overflow");
      return;
    }

    const containerRect = this.gridContainer.getBoundingClientRect();
    const newRects = new Map<string, NodeRect>();

    for (const nodeId of this.treeConfig.allNodes) {
      const slotElement = this.element.querySelector(`[slot="${nodeId}"]`) as HTMLElement;
      if (slotElement) {
        newRects.set(nodeId, getNodeRect(slotElement, containerRect));
      }
    }

    // only a real change is written: every write renders, and every render measures
    if (!sameNodeRects(this.nodeRects, newRects)) {
      this.nodeRects = newRects;
    }
    this.svgWidth = containerRect.width;
    this.svgHeight = containerRect.height;

    this.checkOverflow();
  }

  /** Sets WARN_overflow when the tree is larger than its parent: the layout cell would cut it off silently. */
  private checkOverflow() {
    const errId = "WARN_overflow";
    const parent = getParentDimensions(this.element);
    const width = this.gridContainer?.scrollWidth || 0;
    const height = this.gridContainer?.scrollHeight || 0;

    const dims: string[] = [];
    if (parent.width > 0 && width > parent.width + 1) {
      dims.push(`width (${Math.round(width)}px > ${Math.round(parent.width)}px)`);
    }
    // the tree does not adapt to the height it has: only what an ancestor really cuts off counts
    const clipped = getClippedHeight(this.element, height);
    if (clipped > 1) {
      dims.push(`height (${Math.round(height)}px > ${Math.round(height - clipped)}px)`);
    }

    if (dims.length === 0) {
      this.errors.remove(errId);
      return;
    }

    this.errors.addOrReplace({
      id: errId,
      type: "warning",
      message: `Tree exceeds available ${dims.join(" and ")} and will be cut off. Reduce level-spacing, node-spacing or the node content, or enlarge the container.`,
    });
  }

  private getSlotStyle(nodeId: string): { [key: string]: string } {
    if (!this.layout) {
      return {};
    }

    const position = this.layout.positions.get(nodeId);
    if (!position) {
      return {};
    }

    const isHorizontal = this.direction === "ltr" || this.direction === "rtl";

    if (isHorizontal) {
      return {
        "grid-column": String(getActualGridColumn(position.gridColumn)),
        "grid-row": `${getActualGridRow(position.gridRow)} / span ${getActualGridRowSpan(position.gridRowSpan)}`,
        "align-self": "center",
      };
    } else {
      return {
        "grid-row": String(getActualGridRow(position.gridRow)),
        "grid-column": `${getActualGridColumn(position.gridColumn)} / span ${getActualGridColumnSpan(position.gridColumnSpan)}`,
        "justify-self": "center",
      };
    }
  }

  private renderEdges() {
    if (!this.treeConfig || this.nodeRects.size === 0) {
      return null;
    }

    const treeStyle = this.getTreeStyle();
    const paths: string[] = [];
    const operators: string[] = [];

    // Build a map of child -> list of parents (to detect nodes with multiple parents)
    const childToParents = new Map<string, string[]>();
    for (const edge of this.treeConfig.edges) {
      const parents = childToParents.get(edge.to) || [];
      parents.push(edge.from);
      childToParents.set(edge.to, parents);
    }

    // One bend per parent: all its edges meet in one bus, and the operators sit on it
    const bends = new Map<string, number>();
    for (const [parent, children] of this.treeConfig.adjacencyList.entries()) {
      const parentRect = this.nodeRects.get(parent);
      const childRects = children.map((child) => this.nodeRects.get(child)).filter((rect) => rect !== undefined);
      const bend = parentRect ? calculateBend(parentRect, childRects, this.direction) : undefined;
      if (bend !== undefined) {
        bends.set(parent, bend);
      }
    }

    // Render edges connecting parents to children
    for (const edge of this.treeConfig.edges) {
      const fromRect = this.nodeRects.get(edge.from);
      const toRect = this.nodeRects.get(edge.to);

      if (!fromRect || !toRect) {
        continue;
      }

      const start = getConnectionPoint(fromRect, true, this.direction);

      // For nodes with multiple parents, use offset connection points
      const parents = childToParents.get(edge.to) || [];
      let end: { x: number; y: number };
      if (parents.length > 1) {
        const parentIndex = parents.indexOf(edge.from);
        end = getMultiParentConnectionPoint(toRect, this.direction, parentIndex, parents.length);
      } else {
        end = getConnectionPoint(toRect, false, this.direction);
      }

      const { path } = generateEdgePath(start, end, this.edgeStyle, this.direction, bends.get(edge.from));
      const svgStyle = getEdgeSvgStyle(treeStyle.edgeColor, treeStyle.edgeWidth, edge.style);

      paths.push(
        <path
          key={`edge-${edge.from}-${edge.to}`}
          d={path}
          fill="none"
          stroke={svgStyle.stroke}
          stroke-width={svgStyle.strokeWidth}
          stroke-dasharray={svgStyle.strokeDasharray}
        />,
      );
    }

    // Render operators between siblings
    if (this.showOperators) {
      for (const [parent, children] of this.treeConfig.adjacencyList.entries()) {
        const bend = bends.get(parent);
        if (bend === undefined) {
          continue;
        }

        for (let i = 0; i < children.length - 1; i++) {
          const child = children[i];
          const nextChild = children[i + 1];
          const edge = getEdgeForChild(this.treeConfig.edges, parent, child);

          if (!edge?.operator || edge.operator === "none") {
            continue;
          }

          const childRect = this.nodeRects.get(child);
          const nextChildRect = this.nodeRects.get(nextChild);

          if (!childRect || !nextChildRect) {
            continue;
          }

          const operatorSymbol = edge.label ?? getOperatorSymbol(edge.operator);
          const position = calculateOperatorPosition(bend, childRect, nextChildRect, this.direction);

          operators.push(
            <g key={`operator-${parent}-${child}`} class="operator-group">
              <circle
                cx={position.x}
                cy={position.y}
                r={treeStyle.operatorCircleRadius}
                fill="white"
                stroke={treeStyle.edgeColor}
                stroke-width={treeStyle.edgeWidth}
              />
              <text
                x={position.x}
                y={position.y}
                text-anchor="middle"
                dominant-baseline="central"
                style={{
                  fontSize: `${treeStyle.operatorFontSize}px`,
                  fill: treeStyle.operatorColor,
                  fontWeight: "bold",
                }}
              >
                {operatorSymbol}
              </text>
            </g>,
          );
        }
      }
    }

    return (
      <svg
        class="edge-layer"
        width={this.svgWidth}
        height={this.svgHeight}
        style={{ position: "absolute", top: "0", left: "0", pointerEvents: "none" }}
      >
        {paths}
        {operators}
      </svg>
    );
  }

  private renderSlots() {
    if (!this.treeConfig || !this.layout) {
      return null;
    }

    return Array.from(this.treeConfig.allNodes).map((nodeId) => (
      // data-bn-fit-content: a node is as high as its content, so no height in it is a limit
      // for that content (see findConstrainedHeight in utils/parentDimensions)
      <div key={nodeId} class="tree-node" data-bn-fit-content="" style={this.getSlotStyle(nodeId)}>
        <slot name={nodeId} />
      </div>
    ));
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
    const fontStyles = this.getFontStyles();

    if (!this.treeConfig || !this.layout) {
      return (
        <Host style={fontStyles}>
          <div class="tree-container tree-error">
            <slot />
          </div>
        </Host>
      );
    }

    const gridStyle = {
      display: "grid",
      "grid-template-columns": this.layout.gridTemplateColumns,
      "grid-template-rows": this.layout.gridTemplateRows,
      position: "relative",
    };

    return (
      <Host style={fontStyles}>
        <div class="tree-container">
          <div class="tree-grid" style={gridStyle}>
            {this.renderEdges()}
            {this.renderSlots()}
          </div>
        </div>
      </Host>
    );
  }
}
