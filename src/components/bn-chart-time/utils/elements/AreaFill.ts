import { G } from "@svgdotjs/svg.js";
import { SCENARIO_AREA_STYLES } from "../../../../utils/notation";

const GRAYSCALE_AREA_STYLES = [
  { fill: "#000000", opacity: 0.3 },
  { fill: "#555555", opacity: 0.25 },
  { fill: "#999999", opacity: 0.2 },
  { fill: "#bbbbbb", opacity: 0.15 },
  { fill: "#dddddd", opacity: 0.1 },
];

export interface AreaPoint {
  x: number;
  y: number;
}

/**
 * Draws an SVG path filling the area between an upper boundary polyline
 * and a lower boundary polyline - used for stacked area charts.
 */
export class AreaFill {
  private readonly group: G;
  private readonly upperPoints: AreaPoint[];
  private readonly lowerPoints: AreaPoint[];
  private readonly scenarioType: string | null;
  private readonly segmentIndex: number;
  private readonly isScenarioStack: boolean;

  constructor(
    parentGroup: G,
    upperPoints: AreaPoint[],
    lowerPoints: AreaPoint[],
    scenarioType: string | null,
    segmentIndex: number,
    isScenarioStack: boolean,
  ) {
    this.group = parentGroup.group().id(`area_fill_${segmentIndex}`);
    this.upperPoints = upperPoints;
    this.lowerPoints = lowerPoints;
    this.scenarioType = scenarioType;
    this.segmentIndex = segmentIndex;
    this.isScenarioStack = isScenarioStack;
  }

  public draw(): void {
    if (this.upperPoints.length < 2 || this.lowerPoints.length < 2) {
      return;
    }

    // Build SVG path: upper line forward, then lower line backward
    let pathStr = `M ${this.upperPoints[0].x},${this.upperPoints[0].y}`;
    for (let i = 1; i < this.upperPoints.length; i++) {
      pathStr += ` L ${this.upperPoints[i].x},${this.upperPoints[i].y}`;
    }
    // Walk lower points in reverse to close the shape
    for (let i = this.lowerPoints.length - 1; i >= 0; i--) {
      pathStr += ` L ${this.lowerPoints[i].x},${this.lowerPoints[i].y}`;
    }
    pathStr += " Z";

    let fill: string;
    let opacity: number;

    if (this.isScenarioStack && this.scenarioType) {
      const prefix = this.scenarioType.slice(0, 2).toLowerCase();
      const style = SCENARIO_AREA_STYLES[prefix] || SCENARIO_AREA_STYLES["ac"];
      fill = style.fill;
      opacity = style.opacity;
    } else {
      const idx = Math.min(this.segmentIndex, GRAYSCALE_AREA_STYLES.length - 1);
      fill = GRAYSCALE_AREA_STYLES[idx].fill;
      opacity = GRAYSCALE_AREA_STYLES[idx].opacity;
    }

    this.group.path(pathStr).fill(fill).opacity(opacity).stroke("none");
  }

  /**
   * Draw the boundary line on top of the area fill.
   */
  public drawBoundaryLine(): void {
    if (this.upperPoints.length < 2) {
      return;
    }

    let lineColor = "#000000";
    let dashArray: string | undefined;

    if (this.isScenarioStack && this.scenarioType) {
      const prefix = this.scenarioType.slice(0, 2).toLowerCase();
      const style = SCENARIO_AREA_STYLES[prefix] || SCENARIO_AREA_STYLES["ac"];
      lineColor = style.lineColor;
      dashArray = style.dashArray;
    }

    const polyline = this.group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .polyline(this.upperPoints.map((p) => [p.x, p.y]) as any)
      .fill("none")
      .stroke({ color: lineColor, width: 1.5 });

    if (dashArray) {
      polyline.attr("stroke-dasharray", dashArray);
    }
  }
}
