import { DataPoint, TimeChartDimension } from "../model";
import { HookLocation, Label } from "./Label";

import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
// import {
//   SVGStyle,
// } from "../../../../utils/model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { SVGStyle } from "../../../../utils/model";
// import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";

export class Line {
  private readonly ID_DATA_PREFIX: string = "DATA";
  private readonly ID_SCENARIO_PREFIX: string = "SCENARIO";
  private readonly ID_RECT: string = "RECT";
  private readonly FALLBACK_COLOUR: string = "#000000";
  private readonly isPrimaryLine: boolean;
  private readonly scenarioGroup: G;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly LineBarStyles: any;
  private dataPoint: DataPoint;
  //  private previousDataPoint: DataPoint;
  private readonly styles: TimeChartStyle;
  // @ts-ignore
  private index: number;

  private position: ElementPositions;

  private label: Label | null = null;

  private scenarioLabel: Label | null = null;
  private LineGroup: G | null;
  private isVarianceLine: boolean = false;

  private dimensions: TimeChartDimension = {
    columnLength: 0,
    xPos: 0,
    yPos: 0,
    labelYPos: 0,
    scenarioLabelXPos: 0,
    scenarioLabelYPos: 0,
    clipped: false,
  };

  private previousDimensions: TimeChartDimension = {
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
    previousDataPoint: DataPoint,
    index: number,
    isPrimaryLine: boolean,
    scenarioGroup: G,
    LineLabel: string | null,
  ) {
    this.dataPoint = dataPoint;
    // this.previousDataPoint = previousDataPoint;
    this.index = index;
    this.isPrimaryLine = isPrimaryLine;
    this.position = position;
    this.LineBarStyles = styles.barStyles;

    this.scenarioGroup = scenarioGroup;
    this.styles = styles;

    this.LineGroup = scenarioGroup.group().id(scenarioGroup.toString() + "_" + this.ID_RECT);

    if (dataPoint?.isEmpty() != true) {
      this.hasData = true;
      this.dimensions = this.createDimensions(dataPoint, index, isPrimaryLine);
      this.label = this.getDataLabel(dataPoint);
      this.scenarioLabel = this.getScenarioLabel(LineLabel);
    }

    this.previousDimensions = this.createDimensions(previousDataPoint, index - 1, isPrimaryLine);
  }

  public setAsVariance(): Line {
    this.isVarianceLine = true;
    this.label?.setToVarianceLabel();
    return this;
  }

  public updateLabelGroup(newGroup: G): Line {
    if (this.isEmpty()) {
      return this;
    }

    this.label?.updateGroup(newGroup);
    return this;
  }

  public draw(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ) {
    // TODE: JHE: Remove DataFOrmatDigits Type Duplicates
    if (this.isEmpty()) {
      return this;
    }

    const scenarioStyle: SVGStyle | undefined = this.getScenarioStyle();
    // let strokeStyle =  "#00FF00"; //this.convertToSVGStyle(scenarioStyle, "stroke");
    const fillStyle = this.getFillStyle(scenarioStyle);

    if (this.LineGroup != null) {
      this.LineGroup.line([
        [this.previousDimensions.xPos, this.previousDimensions.yPos],
        [this.dimensions.xPos, this.dimensions.yPos],
      ])
        .fill(fillStyle)
        .stroke({ color: "#f06", width: 3, linecap: "round" });
    }
    this.drawLineDataLabel(dataFormatDigits, measureScale);
    this.drawScenarioLabel();
  }

  public createDimensions(dataPoint: DataPoint, index: number, isPrimaryBar: boolean): TimeChartDimension {
    return {
      clipped: false,
      columnLength: dataPoint.getScaledUnit(),
      xPos: this.position.getColumnPositionX(index, isPrimaryBar),
      yPos: this.position.getColumnPositionY() - dataPoint.getScaledUnit(),
      labelYPos: this.position.getColumnDataLabelPositionY(dataPoint.getScaledUnit()),
      scenarioLabelXPos:
        this.position.getColumnPositionX(index, isPrimaryBar) +
        this.position.getScenarioLabelPositionOffsetX(isPrimaryBar),
      scenarioLabelYPos: this.position.getColumnPositionY() - dataPoint.getScaledUnit(),
    };
  }

  private getDataLabel(dataPoint: DataPoint) {
    let labelHook = HookLocation.Bottom;
    if (dataPoint.value != null && dataPoint.value < 0) {
      labelHook = HookLocation.Top;
    }
    return new Label(
      this.scenarioGroup,
      this.position.getColumnCenterPositionX(this.index),
      this.position.getColumnDataLabelPositionY(this.dataPoint.getScaledUnit()),
      this.ID_DATA_PREFIX,
      dataPoint.value,
      this.styles,
      labelHook,
      HookLocation.Center,
    );
  }

  private getScenarioLabel(LineLabel: string | null) {
    return new Label(
      this.scenarioGroup,
      0,
      0,
      this.ID_SCENARIO_PREFIX,
      LineLabel,
      this.styles,
      HookLocation.Bottom,
      HookLocation.Left,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertToSVGStyle(style: any, mode: string): any {
    if (style == null) {
      style = [];
    }
    style["color"] = style[mode] || this.FALLBACK_COLOUR;
    return { ...style };
  }

  private drawScenarioLabel() {
    if (this.scenarioLabel != null && !this.scenarioLabel.isEmpty() && !this.isVarianceLine) {
      this.scenarioLabel.setPos(this.dimensions.scenarioLabelXPos, this.dimensions.scenarioLabelYPos).draw(true);
    }
  }

  private drawLineDataLabel(dataFormatDigits: DataFormatDigits, measureScale: SiPrefix = new SiPrefix()) {
    this.label?.draw(this.isPrimaryLine, dataFormatDigits, measureScale);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getFillStyle(scenarioStyle: SVGStyle | undefined): any {
    const pattern = this.LineBarStyles[this.dataPoint.getScenario() as string];

    if (pattern?.fillpattern && this.styles.pattern.get(pattern.fillpattern)?.pattern) {
      return this.styles?.pattern?.get(pattern.fillpattern)?.pattern;
    }

    return this.convertToSVGStyle(scenarioStyle, "fill");
  }

  private getScenarioStyle(): SVGStyle | undefined {
    if (this.isVarianceLine) {
      return this.styles?.varianceStyles.getSVGStyle(this.dataPoint.getVarianceStyle());
    }

    return this.LineBarStyles[this.dataPoint.getScenario() as string];
  }

  private isEmpty(): boolean {
    return false === this.hasData || Number.isNaN(this.dataPoint.value);
  }
}
