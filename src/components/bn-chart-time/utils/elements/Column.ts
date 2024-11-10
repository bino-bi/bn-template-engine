import {DataPoint, TimeChartDimension,} from "../model";
import {HookLocation, Label} from "./Label";

import {G} from "@svgdotjs/svg.js";
import {ElementPositions,} from "../helper";
// import {
//   SVGStyle,
// } from "../../../../utils/model";
import {TimeChartStyle} from "../model/styles/TimeChartStyle";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { SVGStyle } from "../../../../utils/model";
// import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";

export class Column {

  private readonly ID_DATA_PREFIX: string = "DATA";
  private readonly ID_SCENARIO_PREFIX: string = "SCENARIO";
  private readonly ID_RECT: string = "RECT";
  private readonly FALLBACK_COLOUR: string = "#000000";
  private readonly isPrimaryColumn: boolean;
  private readonly scenarioGroup: G;
  private readonly columnBarStyles: any;
  private dataPoint: DataPoint;
  private readonly styles: TimeChartStyle;
  // @ts-ignore
  private index: number;

  private position: ElementPositions;
  private label: Label | null = null;

  private scenarioLabel: Label | null = null;
  private columnGroup: G | null;
  private isVarianceColumn: boolean = false;

  private dimensions: TimeChartDimension = {
    columnLength: 0,
    xPos: 0,
    yPos: 0,
    labelYPos: 0,
    scenarioLabelXPos: 0,
    scenarioLabelYPos: 0,
    clipped: false
  };

  private hasData:  boolean = false;

  constructor(position: ElementPositions, styles: TimeChartStyle, dataPoint: DataPoint, index: number, isPrimaryColumn: boolean, scenarioGroup: G, columnLabel: string | null) {
    this.dataPoint = dataPoint;
    this.index = index;
    this.isPrimaryColumn = isPrimaryColumn;
    this.position = position;
    this.columnBarStyles = styles.barStyles;

    this.scenarioGroup = scenarioGroup;
    this.styles = styles;

    this.columnGroup = scenarioGroup.group().id(scenarioGroup.toString() + "_" + this.ID_RECT);

    if(dataPoint?.isEmpty() != true) {
      this.hasData = true;
      this.dimensions = this.createDimensions(dataPoint, index, isPrimaryColumn);
      this.label = this.getDataLabel(dataPoint);
      this.scenarioLabel = this.getScenarioLabel(columnLabel);
    }
  }

  public setAsVariance(): Column {
    this.isVarianceColumn = true;
    this.label?.setToVarianceLabel();
    return this;
  }

  public updateLabelGroup(newGroup: G): Column {
    if( this.isEmpty() ) {
      return this;
    }

    this.label?.updateGroup(newGroup);
    return this;
  }

  public draw(dataFormatDigits: DataFormatDigits = {percent: 2, decimal: 1}, measureScale: SiPrefix = new SiPrefix()) {  // TODE: JHE: Remove DataFOrmatDigits Type Duplicates
    if (this.isEmpty()) {
      return this;
    }

    let scenarioStyle: SVGStyle | undefined = this.getScenarioStyle();
    let strokeStyle = this.convertToSVGStyle(scenarioStyle, "stroke");
    let fillStyle = this.getFillStyle(scenarioStyle);

    if(this.columnGroup != null) {
      this.columnGroup.rect(this.position.getColumnWidth(), this.dimensions.columnLength)
        .fill(fillStyle)
        .stroke(strokeStyle)
        .y(this.dimensions.yPos)
        .cx(this.dimensions.xPos);

    }
    this.drawColumnDataLabel(dataFormatDigits, measureScale);
    this.drawScenarioLabel();

  }

  public createDimensions(dataPoint: DataPoint, index: number, isPrimaryBar: boolean): TimeChartDimension {

    if (dataPoint.getScaledUnit() < 0) {
      return {
        clipped: false,
        columnLength: Math.abs(dataPoint.getScaledUnit()),
        xPos: this.position.getColumnPositionX(index, isPrimaryBar),
        yPos: this.position.getColumnPositionY(),
        labelYPos: this.position.getColumnDataLabelPositionY(dataPoint.getScaledUnit()),
        scenarioLabelXPos: this.position.getColumnPositionX(index, isPrimaryBar) + this.position.getScenarioLabelPositionOffsetX(isPrimaryBar),
        scenarioLabelYPos: this.position.getColumnPositionY() + (Math.abs(dataPoint.getScaledUnit()) * 0.5)
      };
    } else {
      return {
        clipped: false,
        columnLength: dataPoint.getScaledUnit(),
        xPos: this.position.getColumnPositionX(index, isPrimaryBar),
        yPos: this.position.getColumnPositionY() - dataPoint.getScaledUnit(),
        labelYPos: this.position.getColumnDataLabelPositionY(dataPoint.getScaledUnit()),
        scenarioLabelXPos: this.position.getColumnPositionX(index, isPrimaryBar) + this.position.getScenarioLabelPositionOffsetX(isPrimaryBar),
        scenarioLabelYPos: this.position.getColumnPositionY() - (Math.abs(dataPoint.getScaledUnit()) * 0.5)
      };
    }
  }

  private getDataLabel(dataPoint: DataPoint) {
    let labelHook = HookLocation.Bottom;
    if (dataPoint.value != null && dataPoint.value < 0) {
      labelHook = HookLocation.Top;

    }
    return new Label(this.scenarioGroup, this.position.getColumnCenterPositionX(this.index), this.position.getColumnDataLabelPositionY(this.dataPoint.getScaledUnit()), this.ID_DATA_PREFIX, dataPoint.value, this.styles, labelHook, HookLocation.Center);
  }

  private getScenarioLabel(columnLabel: string | null) {
    if (this.isPrimaryColumn) {
      return new Label(this.scenarioGroup, -1, -1, this.ID_SCENARIO_PREFIX, columnLabel, this.styles, HookLocation.Center, HookLocation.Left);
    }

    return new Label(this.scenarioGroup, -1, -1, this.ID_SCENARIO_PREFIX, columnLabel, this.styles, HookLocation.Center,  HookLocation.Right);
  }

  private convertToSVGStyle(style: any, mode: string): any {
    if (style == null) {
      style = [];
    }
    style["color"] = style[mode] || this.FALLBACK_COLOUR;
    return {...style};
  }

  private drawScenarioLabel() {
    if (this.scenarioLabel != null &&  !this.scenarioLabel.isEmpty() && !this.isVarianceColumn) {
     this.scenarioLabel.setPos(this.dimensions.scenarioLabelXPos, this.dimensions.scenarioLabelYPos).draw(true);
    }
  }

  private drawColumnDataLabel(dataFormatDigits: DataFormatDigits, measureScale: SiPrefix = new SiPrefix()) {
     this.label?.draw(this.isPrimaryColumn, dataFormatDigits, measureScale);
  }

  private getFillStyle(scenarioStyle: SVGStyle | undefined): any {
    let pattern = this.columnBarStyles[this.dataPoint.getScenario() as string];

    if (pattern?.fillpattern && this.styles.pattern.get(pattern.fillpattern)?.pattern) {
      return this.styles?.pattern?.get(pattern.fillpattern)?.pattern;
    }

    return this.convertToSVGStyle(scenarioStyle, "fill");
  }

  private getScenarioStyle(): SVGStyle |  undefined {
    if (this.isVarianceColumn) {
      return this.styles?.varianceStyles.getSVGStyle(this.dataPoint.getVarianceStyle());
    }

    return this.columnBarStyles[this.dataPoint.getScenario() as string];
  }

  private isEmpty(): boolean {   
    return false === this.hasData || Number.isNaN(this.dataPoint.value);
  }
}
