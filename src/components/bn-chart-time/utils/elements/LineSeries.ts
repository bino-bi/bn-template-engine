import { G } from "@svgdotjs/svg.js";
import { DataPoint } from "../model";
import { HookLocation, Label } from "./Label";
import { ElementPositions } from "../helper";
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

  private readonly scenarioGroup: G;
  private readonly labelGroup: G;
  private readonly styles: TimeChartStyle;
  private readonly position: ElementPositions;
  private readonly dataPoints: LineSeriesDataPoint[];
  private readonly scenarioName: string;
  private readonly scenarioLabel: string | null;

  constructor(
    position: ElementPositions,
    styles: TimeChartStyle,
    dataPoints: LineSeriesDataPoint[],
    scenarioGroup: G,
    labelGroup: G,
    scenarioName: string,
    scenarioLabel: string | null,
    _i18n: Map<string | number, string>
  ) {
    this.position = position;
    this.styles = styles;
    this.dataPoints = dataPoints;
    this.scenarioGroup = scenarioGroup;
    this.labelGroup = labelGroup;
    this.scenarioName = scenarioName;
    this.scenarioLabel = scenarioLabel;
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
    const halfSize = this.MARKER_SIZE / 2;

    for (const point of this.dataPoints) {
      if (point.dataPoint.isEmpty()) {
        continue;
      }

      const centerX = this.position.getColumnCenterPositionX(point.index);
      const centerY = this.position.getColumnPositionY() - point.dataPoint.getScaledUnit();

      // Draw square marker centered on the data point
      markerGroup.rect(this.MARKER_SIZE, this.MARKER_SIZE)
        .fill(lineStyle.markerFill)
        .stroke({ color: lineStyle.markerStroke, width: 1 })
        .move(centerX - halfSize, centerY - halfSize);
    }
  }

  private drawValueLabels(dataFormatDigits: DataFormatDigits, measureScale: SiPrefix): void {
    for (const point of this.dataPoints) {
      if (point.dataPoint.isEmpty() || point.dataPoint.value === null) {
        continue;
      }

      const centerX = this.position.getColumnCenterPositionX(point.index);
      const markerTopY = this.position.getColumnPositionY() - point.dataPoint.getScaledUnit() - (this.MARKER_SIZE / 2) - 2;

      // Determine label hook location based on value sign
      const labelHook = point.dataPoint.value < 0 ? HookLocation.Top : HookLocation.Bottom;

      const label = new Label(
        this.labelGroup,
        centerX,
        markerTopY,
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
