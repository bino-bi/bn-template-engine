import { Scenario } from "../model";
import { ElementPositions } from "../helper";
import { G, Svg } from "@svgdotjs/svg.js";

export class Axis {
  private scenarioType: Scenario;

  private svgGroup: G;
  private position: ElementPositions;

  private readonly labelText: string | null;
  private readonly ID_AXIS: string = "axis";
  private readonly CSS_AXIS_TITLE: string = "categories";
  private readonly isRelative: boolean;

  constructor(
    axis: { scenarioType: Scenario; labelText?: string; isRelative?: boolean },
    position: ElementPositions,
    svgParentGroup: G | Svg,
  ) {
    this.scenarioType = axis.scenarioType;
    this.labelText = axis.labelText || null;
    this.isRelative = axis.isRelative || false;
    this.position = position;

    this.svgGroup = svgParentGroup.group().id(this.ID_AXIS);
  }

  private drawAxisTitle(group: G, text: string) {
    if (null == text) {
      text = "";
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const title: any = group.text(text).addClass(this.CSS_AXIS_TITLE).attr("text-anchor", "middle");

    title.move(this.position.getAxisTitlePositionX(group), this.position.getAxisTitlePositionY(true, this.isRelative));
  }

  public draw(): Axis {
    if (this.labelText) {
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
    if (this.scenarioType == undefined || this.scenarioType == null) {
      return "default";
    }
    return `${this.scenarioType}`.slice(0, 2);
  }
}
