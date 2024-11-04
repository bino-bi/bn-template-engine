import {StructureChartStyle, DataPoint, StructureChartDimension,} from "../model";
import {HookLocation, Label} from "./Label";

import {G} from "@svgdotjs/svg.js";
import {ElementPositions,} from "../helper";
import { SVGPolgonPattern, SVGStyle, SVGStyleGroup } from "../../../../../utils/model";
import { DataFormatDigits } from "../../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../../utils/model/SiPrefix";
// import {HookLocation} from "../../../ibcs-chart-time/utils/elements";
// import {SVGPolgonPattern, SVGStyle} from "../../../../utils/model";
// import {SVGStyleGroup} from "../../../../utils/model/styles/SVGStyleGroup";
// import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";

export class Bar {

  readonly ID_DATA_PREFIX: string = "DATA";
  readonly ID_SCENARIO_PREFIX: string = "SCENARIO";
  readonly ID_RECT: string = "RECT";
  readonly FALLBACK_COLOUR: string = "#000000";

  private dataPoint: DataPoint;
  // @ts-ignore
  private index: number;
  private readonly isPrimaryBar: boolean;
  private position: ElementPositions;
  private label: Label | null = null;
  private readonly scenarioGroup: G | null;
  private readonly barStyles: SVGStyleGroup;
  private readonly styles: StructureChartStyle;
  private readonly scenarioLabel: Label | null = null;
  private barGroup: G | null = null;
  private isVarianceBar: boolean = false;

  private dimensions: StructureChartDimension = {
    barLength: 0,
    xPos: 0,
    yPos: 0,
    labelXPos: 0,
    scenarioLabelXPos: 0,
    scenarioLabelYPos: 0,
    clipped: false
  };
  private hasData: boolean = false;

  constructor(position: ElementPositions, styles: StructureChartStyle, dataPoint: DataPoint, index: number, isPrimaryBar: boolean, scenarioGroup: G, barLabel: string | null) {
    this.dataPoint = dataPoint;
    this.index = index;
    this.isPrimaryBar = isPrimaryBar;
    this.position = position;
    this.barStyles = styles.barStyles;

    this.scenarioGroup = scenarioGroup;
    this.styles = styles;

    if(scenarioGroup != null){
      this.barGroup = scenarioGroup.group().id(scenarioGroup.toString() + "_" + this.ID_RECT);
    }
    
    if (dataPoint?.isEmpty() != true && dataPoint.value != null) {
      this.hasData = true;
      let textLabelHook = HookLocation.Left
      if (dataPoint.value < 0) {
        textLabelHook = HookLocation.Right;
      }
      this.dimensions = this.createDimensions(position, dataPoint, index, isPrimaryBar);
      this.label = new Label(this.scenarioGroup, this.dimensions.labelXPos, this.dimensions.yPos, this.ID_DATA_PREFIX, dataPoint.value, this.styles, HookLocation.Center, textLabelHook);
      this.scenarioLabel = this.getScenarioLabel(barLabel);
    }
  }

  public setAsVariance(): Bar {
    this.isVarianceBar = true;

    this.label?.setToVarianceLabel();

    return this;
  }

  public isRelativeVariance(): Bar {
    this.isVarianceBar = true;
    this.label?.setToRelativeVarianceLabel();
    return this;
  }

  public updateLabelGroup(newGroup: G | undefined): Bar {
    if (this.isEmpty() || newGroup == null) {
      return this;
    }

    this.label?.updateGroup(newGroup);
    return this;
  }

  public draw(dataFormatDigits: DataFormatDigits = {percent: 2, decimal: 1}, measureScale: SiPrefix = new SiPrefix()) {
    if (this.isEmpty() || this.dataPoint.getScenario() == null) {
      return this;
    }

    let scenarioStyle: SVGStyle = this.barStyles.getSVGStyle(this.dataPoint.getScenario()) ; //TODO: JHE: Fix Class? nicht die richitge

    if (this.isVarianceBar) {
      scenarioStyle = this.styles.varianceStyles.getSVGStyle(this.dataPoint.getVarianceStyle());
    }

    let strokeStyle = this.convertToSVGStyle(scenarioStyle, "stroke");
    let fillStyle = this.convertToSVGStyle(scenarioStyle, "fill");
    let fillPattern: string | undefined= this.barStyles.getSVGStyle(this.dataPoint.getScenario()).fillpattern;

    if (fillPattern != null ) {
     
      let polygonPattern: SVGPolgonPattern | undefined = this.styles.pattern.get(fillPattern);
     
      if (polygonPattern != null) {
        fillStyle = polygonPattern.pattern;
      }
    }

    if(this.barGroup != null) {
      this.barGroup.rect(this.dimensions.barLength, this.position.getBarWidth())
        .fill(fillStyle)
        .stroke(strokeStyle)
        .cy(this.dimensions.yPos)
        .x(this.dimensions.xPos);

    }
    this.drawBarDataLabel(dataFormatDigits, measureScale);
    this.drawScenarioLabel();
  }

  private createDimensions(position: ElementPositions, dataPoint: DataPoint, index: number, isPrimaryBar: boolean): StructureChartDimension {

    if (dataPoint.getScaledUnit() < 0) {
      console.log("createDimensions",dataPoint.getScaledUnit(), dataPoint.scenario ,dataPoint.value );
      return {
        clipped: false,
        barLength: Math.abs(dataPoint.getScaledUnit()),
        xPos: position.getBarPositionX() + dataPoint.getScaledUnit(),
        yPos: position.getBarPositionY(index, isPrimaryBar),
        labelXPos: this.position.getLabelPositionX(dataPoint.getScaledUnit()),
        scenarioLabelXPos: this.position.getBarPositionX() - (Math.abs(dataPoint.getScaledUnit()) * 0.5),
        scenarioLabelYPos: this.position.getBarPositionY(index, isPrimaryBar) + this.position.getScenarioLabelPositionOffsetY(isPrimaryBar)
      };
    } else {
      return {
        clipped: false,
        barLength: dataPoint.getScaledUnit(),
        xPos: position.getBarPositionX(),
        yPos: position.getBarPositionY(index, isPrimaryBar),
        labelXPos: this.position.getLabelPositionX(dataPoint.getScaledUnit()),
        scenarioLabelXPos: this.position.getBarPositionX() + (Math.abs(dataPoint.getScaledUnit()) * 0.5),
        scenarioLabelYPos: this.position.getBarPositionY(index, isPrimaryBar) + this.position.getScenarioLabelPositionOffsetY(isPrimaryBar)
      };
    }
  }

  private convertToSVGStyle(style: any, mode: string): any {
    if (style == null) {
      style = [];
    }
    style["color"] = style[mode] || this.FALLBACK_COLOUR;
    return {...style};
  }

  private drawScenarioLabel() {
    if (this.scenarioLabel != null && !this.scenarioLabel.isEmpty() && !this.isVarianceBar) {
      this.scenarioLabel.setPos(this.dimensions.scenarioLabelXPos, this.dimensions.scenarioLabelYPos).draw();
    }
  }

  private drawBarDataLabel(dataFormatDigits: DataFormatDigits, measureScale: SiPrefix = new SiPrefix()) {
    if (this.isPrimaryBar) {
      this.label?.draw(dataFormatDigits, measureScale);
    }
  }

  private isEmpty(): boolean {   
    return false === this.hasData || Number.isNaN(this.dataPoint.value);
  }

  private getScenarioLabel(barLabel: string | null) {
    if (this.isPrimaryBar) {
      return new Label(this.scenarioGroup, -1, -1, this.ID_SCENARIO_PREFIX, barLabel, this.styles, HookLocation.Top, HookLocation.Center);
    }

    return new Label(this.scenarioGroup, -1, -1, this.ID_SCENARIO_PREFIX, barLabel, this.styles, HookLocation.Bottom, HookLocation.Center);
  }


}

