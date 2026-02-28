import { G } from "@svgdotjs/svg.js";

import { DataPoint, TimeChartDimension } from "../model";
import { HookLocation, Label } from "./Label";
import { ElementPositions } from "../helper";
// import {SVGPolgonPattern} from "../../../../utils/model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { SVGPolgonPattern } from "../../../../utils/model";

/**
 * Renders a diamond/triangle marker indicator for PP or PL reference values in a time chart.
 *
 * Markers are small polygon shapes (defined by SVGPolgonPattern) positioned at the
 * data point's scaled value height. They consist of a white background polygon for
 * contrast and a foreground polygon with scenario-specific fill/stroke.
 *
 * Primary markers appear to the left of the column center; secondary markers to the right.
 * Each carries an optional scenario label that is drawn at the marker's data level.
 */
export class Marker {
  readonly ID_DATA_PREFIX: string = "DATA";
  readonly ID_SCENARIO_PREFIX: string = "SCENARIO";
  readonly FALLBACK_COLOUR: string = "#000000";

  private readonly markerGroup: G;
  private markerPattern: SVGPolgonPattern;
  private styles: TimeChartStyle;
  private scenarioLabel: Label | null = null;
  private scenario: string | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly barStyles: any;
  private _defaultMarkerPattern: SVGPolgonPattern | null = null;

  private position: ElementPositions;
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
    markerGroup: G,
    markerPattern: SVGPolgonPattern,
    scenario: string | null,
    styles: TimeChartStyle,
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

    if (dataPoint?.isEmpty() != true) {
      this.hasData = true;
      this.dimensions = this.createMarkerDimensions(dataPoint, index, isPrimaryMarker);
      this.scenarioLabel = this.getScenarioLabel(labelText, styles, isPrimaryMarker);
    }
  }

  public draw(): Marker {
    if (this.isEmpty()) {
      return this;
    }

    const whiteBorder = "#ffffff";
    const strokeStyle = this.convertToSVGStyle(this.barStyles[this.getScenario() as string], "stroke");
    let fillStyle = this.convertToSVGStyle(this.barStyles[this.getScenario() as string], "fill");
    const pattern = this.barStyles[this.getScenario() as string];

    if (pattern != null && pattern.fillpattern) {
      const polygonPattern = this.styles.pattern.get(pattern.fillpattern);

      if (polygonPattern != null) {
        fillStyle = polygonPattern.pattern;
      }
    }

    this.markerGroup
      .polygon(this.markerPattern.background)
      .fill(whiteBorder)
      .cy(this.dimensions.yPos - this.dimensions.columnLength)
      .cx(this.dimensions.xPos);

    this.markerGroup
      .polygon(this.markerPattern.foreground)
      .fill(fillStyle)
      .stroke(strokeStyle)
      .cy(this.dimensions.yPos - this.dimensions.columnLength)
      .cx(this.dimensions.xPos);

    if (this.scenarioLabel != null && !this.scenarioLabel.isEmpty()) {
      this.scenarioLabel.setPos(this.dimensions.scenarioLabelXPos, this.dimensions.scenarioLabelYPos).draw();
    }

    return this;
  }

  public createMarkerDimensions(dataPoint: DataPoint, index: number, isPrimaryMarker: boolean): TimeChartDimension {
    if (dataPoint.getScaledUnit() < 0) {
      return {
        clipped: false,
        labelYPos: 0,
        columnLength: dataPoint.getScaledUnit(),
        xPos: this.position.getMarkerPositionX(index, isPrimaryMarker),
        yPos: this.position.getMarkerPositionY(),
        scenarioLabelXPos:
          this.position.getMarkerPositionX(index, isPrimaryMarker) +
          this.position.getMarkerScenarioLabelPositionOffsetX(isPrimaryMarker),
        scenarioLabelYPos: this.position.getMarkerPositionY() + Math.abs(dataPoint.getScaledUnit()),
      };
    } else {
      return {
        clipped: false,
        labelYPos: 0,
        columnLength: dataPoint.getScaledUnit(),
        xPos: this.position.getMarkerPositionX(index, isPrimaryMarker),
        yPos: this.position.getMarkerPositionY(),
        scenarioLabelXPos:
          this.position.getMarkerPositionX(index, isPrimaryMarker) +
          this.position.getMarkerScenarioLabelPositionOffsetX(isPrimaryMarker),
        scenarioLabelYPos: this.position.getMarkerPositionY() - Math.abs(dataPoint.getScaledUnit()),
      };
    }
  }

  private getScenarioLabel(labelText: string | null, styles: TimeChartStyle, isPrimaryMarker: boolean) {
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
        HookLocation.Center,
        HookLocation.Right,
      );
    }

    return new Label(
      this.markerGroup,
      -1,
      -1,
      this.ID_DATA_PREFIX,
      labelText,
      styles,
      HookLocation.Center,
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

  private isEmpty(): boolean {
    return false == this.hasData;
  }

  private getScenario() {
    return this.scenario?.slice(0, 2);
  }
}
