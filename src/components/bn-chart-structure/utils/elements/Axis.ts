import { StructureChartStyle, Scenario } from "../model";
import { ElementPositions } from "../helper";
import { G, Svg } from "@svgdotjs/svg.js";

import { HookLocation, Label } from "./Label";
// import {HookLocation} from "../../../bn-chart-time-renderer/utils/elements";

/**
 * Renders the vertical baseline axis for a structure chart.
 *
 * The axis line runs vertically from top to bottom of the data area.
 * A CSS class based on the scenario type (e.g. "axis-ac") controls stroke style.
 * An optional title label is drawn at the top of the axis.
 */
export class Axis {
  scenarioType: Scenario;
  labelText: string | null;
  svgGroup: G | Svg;
  position: ElementPositions;
  style: StructureChartStyle;
  height: number = 0;

  readonly ID_AXIS: string = "axis";
  readonly ID_AXIS_TITLE: string = "axis-title";
  readonly CSS_AXIS_TITLE: string = "categories";
  private label: Label;

  constructor(
    axis: { scenarioType: Scenario; labelText?: string; isRelative?: boolean },
    position: ElementPositions,
    svgParentGroup: G | Svg,
    style: StructureChartStyle,
  ) {
    this.scenarioType = axis.scenarioType;
    this.labelText = axis.labelText || null;
    this.position = position;
    this.style = style;

    this.label = new Label(
      svgParentGroup as G,
      this.position.getAxisTitlePositionX(),
      this.position.getAxisTitlePositionY(),
      this.ID_AXIS_TITLE,
      this.labelText,
      this.style,
      HookLocation.Bottom,
      HookLocation.Center,
    );

    this.svgGroup = svgParentGroup.group().id(this.ID_AXIS);
  }

  public draw(): Axis {
    if (this.labelText) {
      this.label.draw();
    }

    this.svgGroup
      .line(
        this.position.getAxisPositionX(),
        this.position.getAxisPositionY(),
        this.position.getAxisEndPositionX(),
        this.position.getAxisEndPositionY(),
      )
      .addClass(this.ID_AXIS + "-" + this.convertScenarioType());

    this.height = this.svgGroup.height() as number;
    return this;
  }

  private convertScenarioType() {
    if (this.scenarioType === undefined || this.scenarioType == null) {
      return "default";
    }
    return `${this.scenarioType}`.slice(0, 2);
  }
}
