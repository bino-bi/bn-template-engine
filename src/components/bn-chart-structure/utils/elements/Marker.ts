import { G } from "@svgdotjs/svg.js";
import { HookLocation, Label } from "./Label";

import { ElementPositions } from "../helper";
// import {SVGPolgonPattern} from "../../../../utils/model";
import { StructureChartDimension, DataPoint, StructureChartStyle } from "../model";
import { SVGPolgonPattern } from "../../../../utils/model";

/**
 * Renders a polygon marker for PP or PL reference values in a structure chart (horizontal layout).
 *
 * Markers are positioned horizontally at the data point's scaled value distance from the axis.
 * They consist of a white background polygon and a scenario-styled foreground polygon.
 * Primary markers sit above the bar center; secondary markers sit below it.
 */
export class Marker {
  readonly ID_DATA_PREFIX: string = "DATA";
  readonly ID_SCENARIO_PREFIX: string = "SCENARIO";
  readonly FALLBACK_COLOUR: string = "#000000";

  private readonly markerGroup: G;
  private markerPattern: SVGPolgonPattern;
  private styles: StructureChartStyle;
  private scenarioLabel: Label | null = null;
  private scenario: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly barStyles: any;
  private _defaultMarkerPattern: SVGPolgonPattern | null = null;

  private position: ElementPositions;
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
    markerGroup: G,
    markerPattern: SVGPolgonPattern,
    scenario: string,
    styles: StructureChartStyle,
    dataPoint: DataPoint,
    index: number,
    labelText: string | null,
    isPrimaryMarker: boolean,
  ) {
    this.position = position;
    this.markerGroup = markerGroup || null;
    this.markerPattern = markerPattern || this._defaultMarkerPattern;
    this.styles = styles;
    this.barStyles = styles ? styles.barStyles : null;
    this.scenario = scenario;

    if (dataPoint?.isEmpty() !== true) {
      this.hasData = true;
      this.dimensions = this.createMarkerDimensions(dataPoint, index, isPrimaryMarker);
      this.scenarioLabel = this.getScenarioLabel(labelText, styles, isPrimaryMarker);
    }
  }

  public createMarkerDimensions(
    dataPoint: DataPoint,
    index: number,
    isPrimaryMarker: boolean,
  ): StructureChartDimension {
    if (dataPoint.getScaledUnit() < 0) {
      return {
        clipped: false,
        labelXPos: 0,
        barLength: Math.abs(dataPoint.getScaledUnit()),
        xPos: this.position.getMarkerPositionX() - Math.abs(dataPoint.getScaledUnit()),
        yPos: this.position.getMarkerPositionY(index, isPrimaryMarker),
        scenarioLabelXPos: this.position.getMarkerPositionX() - Math.abs(dataPoint.getScaledUnit()),
        scenarioLabelYPos:
          this.position.getMarkerPositionY(index, isPrimaryMarker) +
          this.position.getMarkerScenarioLabelPositionOffsetY(isPrimaryMarker),
      };
    } else {
      return {
        clipped: false,
        labelXPos: 0,
        barLength: dataPoint.getScaledUnit(),
        xPos: this.position.getMarkerPositionX() + dataPoint.getScaledUnit(),
        yPos: this.position.getMarkerPositionY(index, isPrimaryMarker),
        scenarioLabelXPos: this.position.getMarkerPositionX() + dataPoint.getScaledUnit(),
        scenarioLabelYPos:
          this.position.getMarkerPositionY(index, isPrimaryMarker) +
          this.position.getMarkerScenarioLabelPositionOffsetY(isPrimaryMarker),
      };
    }
  }

  private getScenarioLabel(labelText: string | null, styles: StructureChartStyle, isPrimaryMarker: boolean) {
    if (this.markerGroup == null) {
      return null;
    }

    if (isPrimaryMarker) {
      return new Label(
        this.markerGroup,
        -1,
        -1,
        this.ID_DATA_PREFIX,
        labelText,
        styles,
        HookLocation.Bottom,
        HookLocation.Center,
      );
    }

    return new Label(
      this.markerGroup,
      -1,
      -1,
      this.ID_DATA_PREFIX,
      labelText,
      styles,
      HookLocation.Top,
      HookLocation.Center,
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

  public draw(): Marker {
    if (this.isEmpty()) {
      return this;
    }

    const whiteBorder = "#ffffff";
    const strokeStyle = this.convertToSVGStyle(this.barStyles[this.getScenario()], "stroke");
    let fillStyle = this.convertToSVGStyle(this.barStyles[this.getScenario()], "fill");
    const pattern = this.barStyles[this.getScenario()];

    if (pattern != null && pattern.fillpattern) {
      const polygonPattern = this.styles.pattern.get(pattern.fillpattern);

      if (polygonPattern != null) {
        fillStyle = polygonPattern.pattern;
      }
    }

    this.markerGroup
      .polygon(this.markerPattern.background)
      .fill(whiteBorder)
      .cy(this.dimensions.yPos)
      .cx(this.dimensions.xPos);

    this.markerGroup
      .polygon(this.markerPattern.foreground)
      .fill(fillStyle)
      .stroke(strokeStyle)
      .cy(this.dimensions.yPos)
      .cx(this.dimensions.xPos);

    if (this.scenarioLabel != null && !this.scenarioLabel.isEmpty()) {
      this.scenarioLabel.setPos(this.dimensions.scenarioLabelXPos, this.dimensions.scenarioLabelYPos).draw();
    }

    return this;
  }

  private isEmpty(): boolean {
    return false === this.hasData;
  }

  private getScenario() {
    return this.scenario?.slice(0, 2);
  }
}
