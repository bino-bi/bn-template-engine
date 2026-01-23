import { G } from "@svgdotjs/svg.js";
import { DataPoint } from "../model";
import { HookLocation, Label } from "./Label";
import { ElementPositions, LabelCollisionManager } from "../helper";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";

/**
 * IBCS Color Schema for Line Chart:
 * | Scenario | Marker Fill | Marker Stroke | Line Style |
 * |----------|-------------|---------------|------------|
 * | AC       | Black       | Black         | Solid      |
 * | PP       | Gray (#999) | Gray          | Solid      |
 * | FC       | White       | Black         | Dashed     |
 * | PL       | White       | Black         | Solid      |
 */
interface LineSeriesStyle {
  markerFill: string;
  markerStroke: string;
  lineColor: string;
  lineDashArray?: string;
}

const IBCS_LINE_STYLES: Record<string, LineSeriesStyle> = {
  ac: { markerFill: "#000000", markerStroke: "#000000", lineColor: "#000000" },
  pp: { markerFill: "#999999", markerStroke: "#999999", lineColor: "#999999" },
  fc: { markerFill: "#ffffff", markerStroke: "#000000", lineColor: "#000000", lineDashArray: "4,4" },
  pl: { markerFill: "#ffffff", markerStroke: "#000000", lineColor: "#000000" },
};

export interface LineSeriesDataPoint {
  dataPoint: DataPoint;
  index: number;
}

export class LineSeries {
  private readonly MARKER_SIZE: number = 8;
  private readonly LINE_WIDTH: number = 2;
  private readonly ID_LINE_PREFIX: string = "LINE";
  private readonly ID_MARKER_PREFIX: string = "MARKER";
  private readonly ID_LABEL_PREFIX: string = "LABEL";
  private readonly ESTIMATED_LABEL_WIDTH: number = 40;
  private readonly ESTIMATED_LABEL_HEIGHT: number = 16;

  private readonly scenarioGroup: G;
  private readonly labelGroup: G;
  private readonly styles: TimeChartStyle;
  private readonly position: ElementPositions;
  private readonly dataPoints: LineSeriesDataPoint[];
  private readonly scenarioName: string;
  private readonly scenarioLabel: string | null;
  private readonly collisionManager: LabelCollisionManager | null;

  constructor(
    position: ElementPositions,
    styles: TimeChartStyle,
    dataPoints: LineSeriesDataPoint[],
    scenarioGroup: G,
    labelGroup: G,
    scenarioName: string,
    scenarioLabel: string | null,
    _i18n: Map<string | number, string>,
    collisionManager: LabelCollisionManager | null = null
  ) {
    this.position = position;
    this.styles = styles;
    this.dataPoints = dataPoints;
    this.scenarioGroup = scenarioGroup;
    this.labelGroup = labelGroup;
    this.scenarioName = scenarioName;
    this.scenarioLabel = scenarioLabel;
    this.collisionManager = collisionManager;
  }

  public draw(dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 }, measureScale: SiPrefix = new SiPrefix()): LineSeries {
    if (this.dataPoints.length === 0) {
      return this;
    }

    const lineStyle = this.getLineStyle();

    // Draw connecting lines between data points
    this.drawLines(lineStyle);

    // Draw markers at each data point
    this.drawMarkers(lineStyle);

    // Draw value labels above each marker
    this.drawValueLabels(dataFormatDigits, measureScale);

    // Draw scenario label to the right of the last data point
    this.drawScenarioLabel();

    return this;
  }

  private getLineStyle(): LineSeriesStyle {
    const scenarioType = this.scenarioName?.slice(0, 2)?.toLowerCase() || "ac";
    return IBCS_LINE_STYLES[scenarioType] || IBCS_LINE_STYLES.ac;
  }

  /**
   * Extracts the scenario variant number (1-4) from the scenario name.
   * e.g., "ac1" -> 1, "pp2" -> 2, "fc3" -> 3, "pl4" -> 4
   */
  private getScenarioVariant(): number {
    const variant = parseInt(this.scenarioName?.slice(-1) || "1", 10);
    return isNaN(variant) ? 1 : Math.min(Math.max(variant, 1), 4);
  }

  /**
   * Draws a square marker (variant 1: ac1, pp1, fc1, pl1)
   */
  private drawSquareMarker(group: G, cx: number, cy: number, style: LineSeriesStyle): void {
    const halfSize = this.MARKER_SIZE / 2;
    group.rect(this.MARKER_SIZE, this.MARKER_SIZE)
      .fill(style.markerFill)
      .stroke({ color: style.markerStroke, width: 1 })
      .move(cx - halfSize, cy - halfSize);
  }

  /**
   * Draws a circle marker (variant 2: ac2, pp2, fc2, pl2)
   */
  private drawCircleMarker(group: G, cx: number, cy: number, style: LineSeriesStyle): void {
    group.circle(this.MARKER_SIZE)
      .fill(style.markerFill)
      .stroke({ color: style.markerStroke, width: 1 })
      .center(cx, cy);
  }

  /**
   * Draws a triangle marker pointing up (variant 3: ac3, pp3, fc3, pl3)
   */
  private drawTriangleMarker(group: G, cx: number, cy: number, style: LineSeriesStyle): void {
    const s = this.MARKER_SIZE / 2;
    group.polygon(`${cx},${cy - s} ${cx - s},${cy + s} ${cx + s},${cy + s}`)
      .fill(style.markerFill)
      .stroke({ color: style.markerStroke, width: 1 });
  }

  /**
   * Draws a diamond marker (variant 4: ac4, pp4, fc4, pl4)
   */
  private drawDiamondMarker(group: G, cx: number, cy: number, style: LineSeriesStyle): void {
    const s = this.MARKER_SIZE / 2;
    group.polygon(`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`)
      .fill(style.markerFill)
      .stroke({ color: style.markerStroke, width: 1 });
  }

  private drawLines(lineStyle: LineSeriesStyle): void {
    const lineGroup = this.scenarioGroup.group().id(this.ID_LINE_PREFIX);

    for (let i = 1; i < this.dataPoints.length; i++) {
      const prevPoint = this.dataPoints[i - 1];
      const currPoint = this.dataPoints[i];

      // Skip if either point has no data
      if (prevPoint.dataPoint.isEmpty() || currPoint.dataPoint.isEmpty()) {
        continue;
      }

      const prevX = this.position.getColumnCenterPositionX(prevPoint.index);
      const prevY = this.position.getColumnPositionY() - prevPoint.dataPoint.getScaledUnit();
      const currX = this.position.getColumnCenterPositionX(currPoint.index);
      const currY = this.position.getColumnPositionY() - currPoint.dataPoint.getScaledUnit();

      const line = lineGroup.line([[prevX, prevY], [currX, currY]])
        .stroke({
          color: lineStyle.lineColor,
          width: this.LINE_WIDTH,
          linecap: 'round'
        })
        .fill('none');

      if (lineStyle.lineDashArray) {
        line.attr('stroke-dasharray', lineStyle.lineDashArray);
      }
    }
  }

  private drawMarkers(lineStyle: LineSeriesStyle): void {
    const markerGroup = this.scenarioGroup.group().id(this.ID_MARKER_PREFIX);
    const variant = this.getScenarioVariant();

    for (const point of this.dataPoints) {
      if (point.dataPoint.isEmpty()) {
        continue;
      }

      const centerX = this.position.getColumnCenterPositionX(point.index);
      const centerY = this.position.getColumnPositionY() - point.dataPoint.getScaledUnit();

      // Draw marker shape based on scenario variant
      switch (variant) {
        case 2:
          this.drawCircleMarker(markerGroup, centerX, centerY, lineStyle);
          break;
        case 3:
          this.drawTriangleMarker(markerGroup, centerX, centerY, lineStyle);
          break;
        case 4:
          this.drawDiamondMarker(markerGroup, centerX, centerY, lineStyle);
          break;
        default: // variant 1 or unknown
          this.drawSquareMarker(markerGroup, centerX, centerY, lineStyle);
          break;
      }
    }
  }

  /**
   * Determines the preferred label position based on line direction.
   * - If line is increasing (going up), label should be on top (HookLocation.Bottom)
   * - If line is decreasing (going down), label should be on bottom (HookLocation.Top)
   *
   * @param pointIndex The index within the dataPoints array
   * @returns HookLocation.Bottom for label on top, HookLocation.Top for label on bottom
   */
  private getLabelPreferredPosition(pointIndex: number): HookLocation {
    const current = this.dataPoints[pointIndex];
    const next = this.dataPoints[pointIndex + 1];
    const prev = this.dataPoints[pointIndex - 1];

    // Check next point first (look forward)
    if (next && !next.dataPoint.isEmpty()) {
      // If next point is higher than current, line is increasing -> label on top
      return next.dataPoint.getScaledUnit() > current.dataPoint.getScaledUnit()
        ? HookLocation.Bottom  // Hook at bottom = label appears above
        : HookLocation.Top;    // Hook at top = label appears below
    }

    // Fall back to previous point if next doesn't exist
    if (prev && !prev.dataPoint.isEmpty()) {
      // If current is higher than previous, line was increasing -> label on top
      return current.dataPoint.getScaledUnit() > prev.dataPoint.getScaledUnit()
        ? HookLocation.Bottom
        : HookLocation.Top;
    }

    // Default: label on top
    return HookLocation.Bottom;
  }

  private drawValueLabels(dataFormatDigits: DataFormatDigits, measureScale: SiPrefix): void {
    for (let i = 0; i < this.dataPoints.length; i++) {
      const point = this.dataPoints[i];
      if (point.dataPoint.isEmpty() || point.dataPoint.value === null) {
        continue;
      }

      const centerX = this.position.getColumnCenterPositionX(point.index);
      const markerY = this.position.getColumnPositionY() - point.dataPoint.getScaledUnit();

      // Determine preferred label hook location based on line direction
      const preferredHook = this.getLabelPreferredPosition(i);

      // Use collision manager to find optimal position if available
      let labelHook = preferredHook;
      if (this.collisionManager) {
        labelHook = this.collisionManager.getOptimalHookLocation(
          centerX,
          markerY,
          this.ESTIMATED_LABEL_WIDTH,
          this.ESTIMATED_LABEL_HEIGHT,
          point.index,
          preferredHook,
          this.MARKER_SIZE
        );

        // Register the label bounds for future collision detection
        const bounds = this.collisionManager.calculateBounds(
          centerX,
          markerY,
          this.ESTIMATED_LABEL_WIDTH,
          this.ESTIMATED_LABEL_HEIGHT,
          point.index,
          labelHook,
          this.MARKER_SIZE
        );
        this.collisionManager.register(bounds);
      }

      // Calculate label Y position based on hook location
      const labelY = labelHook === HookLocation.Bottom
        ? markerY - (this.MARKER_SIZE / 2) - 2  // Label on top
        : markerY + (this.MARKER_SIZE / 2) + 2; // Label on bottom

      const label = new Label(
        this.labelGroup,
        centerX,
        labelY,
        this.ID_LABEL_PREFIX,
        point.dataPoint.value,
        this.styles,
        labelHook,
        HookLocation.Center
      );

      label.draw(true, dataFormatDigits, measureScale);
    }
  }

  private drawScenarioLabel(): void {
    if (!this.scenarioLabel) {
      return;
    }

    // Find the last non-empty data point
    let lastValidPoint: LineSeriesDataPoint | null = null;
    for (let i = this.dataPoints.length - 1; i >= 0; i--) {
      if (!this.dataPoints[i].dataPoint.isEmpty()) {
        lastValidPoint = this.dataPoints[i];
        break;
      }
    }

    if (!lastValidPoint) {
      return;
    }

    const lastX = this.position.getColumnCenterPositionX(lastValidPoint.index) + this.MARKER_SIZE + 4;
    const lastY = this.position.getColumnPositionY() - lastValidPoint.dataPoint.getScaledUnit();

    const scenarioLabelElement = new Label(
      this.labelGroup,
      lastX,
      lastY,
      "SCENARIO_LABEL",
      this.scenarioLabel,
      this.styles,
      HookLocation.Center,
      HookLocation.Left
    );

    scenarioLabelElement.forceStringTypeDraw();
  }
}
