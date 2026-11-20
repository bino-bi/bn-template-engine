import { Scenario } from "../model";
import { ElementPositions } from "../helper";
import { G, Svg } from "@svgdotjs/svg.js";

/**
 * Renders the horizontal baseline axis for a time chart.
 *
 * The axis line spans from the left padding to the end of the data area.
 * A CSS class based on the scenario type (e.g. "axis-ac", "axis-pp") is applied
 * to control stroke style (solid for AC, dashed for FC, etc. per IBCS rules).
 * An optional title label (e.g. "AC" or variance expression) is drawn above the axis.
 */
export class Axis {
  private scenarioType: Scenario;

  private svgGroup: G;
  private position: ElementPositions;

  private readonly labelText: string | null;
  private readonly ID_AXIS: string = "axis";
  private readonly CSS_AXIS_TITLE: string = "categories";
  private readonly isRelative: boolean;
  private readonly titlePosition: string;
  private readonly titleX?: number;

  constructor(
    axis: {
      scenarioType: Scenario;
      labelText?: string;
      isRelative?: boolean;
      titlePosition?: string;
      /** Start of a title at the right, when something stands behind the end of the axis. */
      titleX?: number;
    },
    position: ElementPositions,
    svgParentGroup: G | Svg,
  ) {
    this.scenarioType = axis.scenarioType;
    this.labelText = axis.labelText || null;
    this.isRelative = axis.isRelative || false;
    this.titlePosition = axis.titlePosition || "left";
    this.titleX = axis.titleX;
    this.position = position;

    this.svgGroup = svgParentGroup.group().id(this.ID_AXIS);
  }

  private drawAxisTitle(group: G, text: string) {
    if (null == text) {
      text = "";
    }

    if (this.titlePosition === "right") {
      group
        .text(text)
        .addClass(this.CSS_AXIS_TITLE)
        .move(
          this.titleX ?? this.position.getAxisEndPositionX() + this.position.spacings.labelToColumn,
          this.position.getAxisTitlePositionY(true, this.isRelative),
        );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const title: any = group.text(text).addClass(this.CSS_AXIS_TITLE).attr("text-anchor", "middle");

    title.move(this.position.getAxisTitlePositionX(group), this.position.getAxisTitlePositionY(true, this.isRelative));
  }

  public draw(): Axis {
    if (this.labelText && this.titlePosition !== "none") {
      this.drawAxisTitle(this.svgGroup, this.labelText);
    }

    this.svgGroup
      .line(
        this.position.getAxisPositionX(),
        this.position.getAxisPositionY(this.isRelative),
        this.position.getAxisEndPositionX(),
        this.position.getAxisPositionY(this.isRelative),
      )
      .addClass(this.ID_AXIS + "-" + this.convertScenarioType());

    return this;
  }

  private convertScenarioType() {
    if (this.scenarioType === undefined || this.scenarioType == null) {
      return "default";
    }
    return `${this.scenarioType}`.slice(0, 2);
  }
}
