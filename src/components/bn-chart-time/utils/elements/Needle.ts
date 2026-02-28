import { DataPoint, TimeChartDimension } from "../model";
import { HookLocation, Label } from "./Label";

import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";

import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { SVGVariancesStyleGroup } from "../../../../utils/model";
// import {SVGVariancesStyleGroup} from "../../../../utils/model/styles/SVGVariancesStyleGroup";

/**
 * Renders a relative variance pin (needle) in an IBCS time chart.
 *
 * A needle is a thin vertical bar representing a percentage variance value,
 * topped with an arrowhead. The head style depends on clipping:
 * - Normal: a rectangular crossbar (T-shape)
 * - Clipped (value exceeds 145% scale): a double-arrow polygon indicating the
 *   value was truncated to fit the chart area
 *
 * The needle body uses variance-based fill (positive/negative coloring),
 * while the head always uses the AC scenario style for visual emphasis.
 */
export class Needle {
  readonly ID_DATA_PREFIX: string = "DATA";
  readonly ID_SCENARIO_PREFIX: string = "SCENARIO";
  readonly ID_RECT: string = "RECT";
  readonly FALLBACK_COLOUR: string = "#000000";

  private dataPoint: DataPoint;
  // @ts-ignore
  private index: number;
  private position: ElementPositions;
  private dataLabel: Label | null = null;
  private readonly scenarioGroup: G;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly barStyles: any;

  private readonly styles: TimeChartStyle;
  private barGroup: G;

  private dimensions: TimeChartDimension = {
    columnLength: 0,
    xPos: 0,
    yPos: 0,
    labelYPos: 0,
    scenarioLabelXPos: 0,
    scenarioLabelYPos: 0,
    clipped: false,
  };

  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: TimeChartStyle,
    dataPoint: DataPoint,
    index: number,
    scenarioGroup: G,
  ) {
    this.dataPoint = dataPoint;
    this.index = index;
    this.position = position;
    this.barStyles = styles.barStyles;

    this.scenarioGroup = scenarioGroup;

    this.styles = styles;

    this.barGroup = scenarioGroup.group().id(scenarioGroup.toString() + "_" + this.ID_RECT);

    if (dataPoint?.isEmpty() != true) {
      this.hasData = true;
      this.dimensions = this.createDimensions(position, dataPoint, index);
      this.dataLabel = new Label(
        this.scenarioGroup,
        this.position.getColumnCenterPositionX(this.index),
        this.position.getNeedleDataLabelPositionY(this.dataPoint.getScaledPercentUnit()),
        this.ID_DATA_PREFIX,
        dataPoint.value,
        this.styles,
        HookLocation.Center,
        HookLocation.Center,
      );
      this.dataLabel.setToRelativeVarianceLabel();
    }
  }

  public updateLabelGroup(newGroup: G): Needle {
    if (this.isEmpty()) {
      return this;
    }

    this.dataLabel?.updateGroup(newGroup);
    return this;
  }

  public draw() {
    if (this.isEmpty()) {
      return this;
    }

    const scenarioStyle = this.styles.varianceStyles[this.dataPoint.getVarianceStyle() as keyof SVGVariancesStyleGroup];

    const strokeStyle = this.convertToSVGStyle(scenarioStyle, "stroke");
    let fillStyle = this.convertToSVGStyle(scenarioStyle, "fill");
    const strokeStyleHead = this.convertToSVGStyle(
      this.styles.varianceStyles["ac" as keyof SVGVariancesStyleGroup],
      "stroke",
    );
    const fillStyleHead = this.convertToSVGStyle(
      this.styles.varianceStyles["ac" as keyof SVGVariancesStyleGroup],
      "fill",
    );
    const pattern = this.barStyles[this.dataPoint.getScenario() as string];

    if (pattern != null && pattern.fillpattern) {
      const polygonPattern = this.styles.pattern.get(pattern.fillpattern);

      if (polygonPattern != null) {
        fillStyle = polygonPattern.pattern;
      }
    }

    if (this.dimensions.clipped) {
      this.createClippedNeedleHead(fillStyle, strokeStyle);
    } else {
      this.createNeedleHead(strokeStyleHead, fillStyleHead);
    }

    this.barGroup
      .rect(this.position.getNeedleWidth(), this.dimensions.columnLength)
      .cx(this.dimensions.xPos)
      .y(this.dimensions.yPos)
      .fill(fillStyle)
      .stroke(strokeStyle);

    this.dataLabel?.draw();
  }

  private createDimensions(position: ElementPositions, dataPoint: DataPoint, index: number): TimeChartDimension {
    if (dataPoint.getScaledPercentUnit() < 0) {
      return {
        labelYPos: 0,
        scenarioLabelXPos: 0,
        scenarioLabelYPos: 0,
        columnLength: Math.abs(dataPoint.getScaledPercentUnit()),
        xPos: position.getColumnCenterPositionX(index),
        yPos: position.getNeedlePositionY(),
        clipped: dataPoint.isClipped(),
      };
    } else {
      return {
        columnLength: dataPoint.getScaledPercentUnit(),
        xPos: position.getColumnCenterPositionX(index),
        yPos: position.getNeedlePositionY() - dataPoint.getScaledPercentUnit(),
        labelYPos: 0,
        scenarioLabelXPos: 0,
        scenarioLabelYPos: 0,
        clipped: dataPoint.isClipped(),
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertToSVGStyle(style: any, mode: string): any {
    if (style == null) {
      style = [];
    }
    style["color"] = style[mode] || this.FALLBACK_COLOUR;
    return { ...style };
  }

  private createClippedNeedleHead(fillStyle: string, strokeStyle: string) {
    const arrowUp = "0,0 5,9 -5,9 0,0 0,5 5,13 -5,13 0,5";

    const head = this.barGroup
      .polygon(arrowUp)
      .fill(fillStyle)
      .cx(this.dimensions.xPos)
      .cy(this.getHeadYPosition())
      .fill(fillStyle)
      .stroke(strokeStyle);

    if (this.dataPoint.value != null && this.dataPoint.value < 0) {
      head.flip("y");
    }
  }

  private createNeedleHead(strokeStyleHead: string, fillStyleHead: string) {
    this.barGroup
      .rect(2 * this.position.getNeedleWidth(), this.position.getNeedleHeadWidth())
      .cx(this.dimensions.xPos)
      .cy(this.getHeadYPosition())
      .fill(strokeStyleHead)
      .stroke(fillStyleHead);
  }

  private isEmpty(): boolean {
    return false === this.hasData || Number.isNaN(this.dataPoint.value);
  }

  private getHeadYPosition() {
    let yPosition = this.dimensions.yPos;

    if (this.dataPoint.value != null && this.dataPoint.value < 0) {
      yPosition += this.dimensions.columnLength;
    }

    return yPosition;
  }
}
