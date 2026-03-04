import { StructureChartStyle, DataPoint, StructureChartDimension } from "../model";
import { HookLocation, Label } from "./Label";

import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { SVGStyle } from "../../../../utils/model";
// import {SVGStyle} from "../../../../utils/model/styles/SVGStyle";

/**
 * Renders a horizontal relative variance pin (needle) in an IBCS structure chart.
 *
 * The needle is a thin horizontal bar representing a percentage variance, with a head:
 * - Normal: a square crossbar at the end of the pin
 * - Clipped (value exceeds the percentage scale): a double-arrow polygon (left or right)
 *   indicating the value was truncated
 *
 * Positive pins extend rightward from the axis; negative pins extend leftward.
 * Labels are placed beyond the needle head with variance-style formatting (percentage + sign).
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
  private label: Label | null = null;
  private scenarioGroup: G;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private barStyles: any;
  private styles: StructureChartStyle;
  private barGroup: G;
  private dimensions: StructureChartDimension = {
    barLength: 0,
    xPos: 0,
    yPos: 0,
    labelXPos: 0,
    scenarioLabelXPos: 0,
    scenarioLabelYPos: 0,
    clipped: false,
  };
  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: StructureChartStyle,
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

    if (dataPoint?.isEmpty() !== true && dataPoint.value != null) {
      this.hasData = true;
      this.dimensions = this.createDimensions(position, dataPoint, index);

      let textLabelHook = HookLocation.Left;
      if (dataPoint.value < 0) {
        textLabelHook = HookLocation.Right;
      }

      this.label = new Label(
        this.scenarioGroup,
        this.dimensions.labelXPos,
        this.dimensions.yPos,
        this.ID_DATA_PREFIX,
        dataPoint.value,
        this.styles,
        HookLocation.Center,
        textLabelHook,
      );
      this.label.setToRelativeVarianceLabel();
    }
  }

  public updateLabelGroup(newGroup: G | undefined): Needle {
    if (this.isEmpty() || newGroup == null) {
      return this;
    }

    this.label?.updateGroup(newGroup);
    return this;
  }

  public draw() {
    if (this.isEmpty()) {
      return this;
    }

    if (this.dimensions == null) {
      return this;
    }

    // Needles always use varianceStyles (falls back to 'neu'); bars use barStyles (falls back to 'ac')
    const scenarioStyle: SVGStyle = this.styles.varianceStyles.getSVGStyle(this.dataPoint.getVarianceStyle());

    const strokeStyle = scenarioStyle.stroke;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fillStyle: any = scenarioStyle.fill;

    const pattern = this.barStyles[this.dataPoint.getScenario() as string];

    if (pattern != null && pattern.fillpattern) {
      const polygonPattern = this.styles.pattern.get(pattern.fillpattern);

      if (polygonPattern != null && polygonPattern.pattern != null) {
        fillStyle = polygonPattern.pattern;
      }
    }
    this.drawNeedleHead(fillStyle, strokeStyle);

    this.barGroup
      .rect(this.dimensions.barLength, this.position.getNeedleWidth())
      .fill(fillStyle)
      .stroke(strokeStyle)
      .cy(this.dimensions.yPos)
      .x(this.dimensions.xPos);

    this.label?.draw();
  }

  private createDimensions(position: ElementPositions, dataPoint: DataPoint, index: number): StructureChartDimension {
    if (dataPoint.getScaledPercentUnit() < 0) {
      return {
        barLength: Math.abs(dataPoint.getScaledPercentUnit()),
        xPos: position.getBarPositionX() + dataPoint.getScaledPercentUnit(),
        yPos: position.getBarCenterPositionY(index),
        labelXPos: this.position.getLabelPositionX(dataPoint.getScaledPercentUnit() - this.position.getNeedleWidth()),
        clipped: dataPoint.isClipped(),
        scenarioLabelXPos: 0,
        scenarioLabelYPos: 0,
      };
    } else {
      return {
        barLength: dataPoint.getScaledPercentUnit(),
        xPos: position.getBarPositionX(),
        yPos: position.getBarCenterPositionY(index),
        labelXPos: this.position.getLabelPositionX(dataPoint.getScaledPercentUnit() + this.position.getNeedleWidth()),
        clipped: dataPoint.isClipped(),
        scenarioLabelXPos: 0,
        scenarioLabelYPos: 0,
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawNeedleHead(fillStyle: any, strokeStyle: string) {
    if (this.dimensions === null) {
      return;
    }
    const strokeStyleHead: string = this.styles.varianceStyles.needleHeadColour;
    const fillStyleHead: string = this.styles.varianceStyles.needleHeadColour;

    if (this.dimensions.clipped) {
      const LEFTARROW: string = "0,0  9,-5  9,5 0,0  5,0  13,-5  13,5  5,0";
      const RIGHTARROW: string = "13,0 4,-5 4,5 13,0 8,0 0,-5 0,5 8,0";

      let polygonPath = RIGHTARROW;
      if (this.dataPoint.value != null && this.dataPoint.value < 0) {
        polygonPath = LEFTARROW;
      }

      this.barGroup
        .polygon(polygonPath)
        .fill(fillStyle)
        .cx(this.getHeadXPosition())
        .cy(this.dimensions.yPos)
        .fill(fillStyle)
        .stroke(strokeStyle);
    } else {
      this.barGroup
        .rect(2 * this.position.getNeedleWidth(), 2 * this.position.getNeedleWidth())
        .cx(this.getHeadXPosition())
        .cy(this.dimensions.yPos)
        .fill(strokeStyleHead)
        .stroke(fillStyleHead);
    }
  }

  private isEmpty(): boolean {
    return false === this.hasData || Number.isNaN(this.dataPoint.value);
  }

  private getHeadXPosition() {
    let xPosition = this.dimensions.xPos;

    if (this.dataPoint.value != null && this.dataPoint.value > 0) {
      xPosition += this.dimensions.barLength;
    }

    return xPosition;
  }
}
