import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import { isValidBoolean, isValidNumber } from "../../utils/validate";
import withComponentStatus from "../../utils/withComponentStatus";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { Style } from "../../stores/componentStyles";

import { TreeConfig, parseTreeConfig, validateEdges, getOperatorSymbol, getEdgeForChild } from "./utils/TreeParser";

import {
  LayoutDirection,
  LayoutResult,
  calculateLayout,
  getActualGridColumn,
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
  calculateOperatorPosition,
  getEdgeSvgStyle,
} from "./utils/EdgeRenderer";

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
    const errId = "ERR_direction";
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
    const errId = "ERR_levelSpacing";

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
    const errId = "ERR_nodeSpacing";

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

  @Watch("edgeStyle")
  validateEdgeStyle(newValue: string) {
    const errId = "ERR_edgeStyle";
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
  @Prop({ attribute: "show-operators" }) showOperators: string = "true";

  @Watch("showOperators")
  validateShowOperators(newValue: string) {
    const errId = "ERR_showOperators";

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: "warning",
        message: `show-operators: invalid value '${newValue}', must be 'true' or 'false'`,
      });
    } else {
      this.errors.remove(errId);
    }
  }

  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
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
    this.validateShowOperators(this.showOperators);
  }

  componentDidLoad() {
    this.setupResizeObserver();
    // Defer DOM measurement to after the browser has completed layout.
    // getBoundingClientRect() can return zeros if called before first paint.
    requestAnimationFrame(() => {
      this.updateNodeRects();
    });
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private setupResizeObserver() {
    this.gridContainer = this.element.shadowRoot?.querySelector(".tree-grid");

    if (!this.gridContainer) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.updateNodeRects();
    });

    // Observe the grid container
    this.resizeObserver.observe(this.gridContainer);

    // Observe all slotted elements
    const slots = this.element.querySelectorAll("[slot]");
    slots.forEach((slot) => {
      this.resizeObserver!.observe(slot);
    });
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

    this.nodeRects = newRects;
    this.svgWidth = containerRect.width;
    this.svgHeight = containerRect.height;
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
        "grid-column": String(getActualGridColumn(position.gridColumn)),
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

      const { path } = generateEdgePath(start, end, this.edgeStyle, this.direction);
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
    if (this.showOperators === "true") {
      for (const [parent, children] of this.treeConfig.adjacencyList.entries()) {
        const parentRect = this.nodeRects.get(parent);
        if (!parentRect) {
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
          const position = calculateOperatorPosition(parentRect, childRect, nextChildRect, this.direction);

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
      <div key={nodeId} class="tree-node" style={this.getSlotStyle(nodeId)}>
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
