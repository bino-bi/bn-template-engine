import { G } from "@svgdotjs/svg.js";
// import {Formatter} from "../../../../utils/formatter";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { Formatter } from "../../../../utils";
import { getContrastTextColor } from "../../../../utils/stackColors";
// import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";

export enum HookLocation {
  Left,
  Center,
  Right,
  Top,
  Bottom,
}

export class Label {
  readonly ID_SCENARIOLABEL: string = "Label";
  readonly CSS_CATEGORIES: string = "categories";
  private x: number;
  private y: number;
  private value: number | string | null;
  private group: G;
  private styles: TimeChartStyle;
  private isVarianceLabel: boolean;
  private isRelativeLabel: boolean = false;
  private segmentFillColor: string | null = null;
  private verticalHookLocation: HookLocation;
  private horizontalHookLocation: HookLocation;

  constructor(
    parent: G,
    xPosition: number,
    yPosition: number,
    groupPrefix: string,
    value: number | string | null,
    styles: TimeChartStyle,
    verticalHookLocation: HookLocation,
    horizontalHookLocation: HookLocation,
  ) {
    this.x = xPosition;
    this.y = yPosition;
    this.value = value;

    this.group = parent.group().id(this.createElementID(parent.toString(), groupPrefix));

    this.styles = styles;
    this.isVarianceLabel = false;

    this.verticalHookLocation = verticalHookLocation || HookLocation.Top;
    this.horizontalHookLocation = horizontalHookLocation || HookLocation.Left;
  }

  public setToVarianceLabel(): Label {
    this.isVarianceLabel = true;

    return this;
  }

  public setToRelativeVarianceLabel(): Label {
    this.isVarianceLabel = true;
    this.isRelativeLabel = true;
    return this;
  }

  public setSegmentFill(color: string): Label {
    this.segmentFillColor = color;
    return this;
  }

  public updateGroup(newGroup: G): Label {
    this.group = newGroup;
    return this;
  }

  public draw(
    displayLabel: boolean = true,
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ): Label {
    if (this.isEmpty()) {
      return this;
    }

    const label: G = this.group;
    let valueStr = "";

    let prefix = "";

    if (Number.isNaN(Number(this.value)) == false) {
      const value = this.value;
      let type = "percent";
      let digits = dataFormatDigits.percent;
      let digitsMin = dataFormatDigits.percent;
      let scale = 1;

      if (this.isRelativeLabel == false) {
        digits = dataFormatDigits.decimal;
        digitsMin = dataFormatDigits.decimal;
        scale = measureScale.value;
        type = "decimal";
      }

      valueStr = Formatter.number(Number(value), type, digits, digitsMin, scale);

      if (this.isVarianceLabel && Number(this.value) >= 0) {
        prefix = "+";
      }
    } else {
      valueStr = "" + this.value;
      // displayLabel = false;
    }

    const labelStr = prefix + valueStr;

    const text = this.drawLabel(label, labelStr);

    if (displayLabel == false) {
      text.addClass("hide");
      label.addClass("hide");
    }

    return this;
  }

  public isEmpty(): boolean {
    return this.value == null || "" === this.value;
  }

  public setPos(xPosition: number, yPosition: number): Label {
    this.x = xPosition;
    this.y = yPosition;
    return this;
  }

  forceStringTypeDraw() {
    const label = this.group;
    const labelStr = "" + this.value;

    this.drawLabel(label, labelStr);

    return this;
  }

  private drawLabel(label: G, labelStr: string) {
    const background: string = this.styles.fontStyles.background || "#ffffff";

    //let text = label.text(labelStr)
    //  .leading(1)
    //  .addClass(this.CSS_CATEGORIES)
    //  .font({anchor: 'middle'})
    //  .move(this.x, this.y);
    let labelAnchor = "start";

    const text = label.text(labelStr);
    text.move(this.x, this.y);

    const boxWidth: number = text.bbox().w;
    const boxHeight: number = text.bbox().h;

    let rectX: number = 0;
    let rectY: number = 0;

    const textX: number = text.x() as number;
    let textY: number = text.y() as number;

    if (this.horizontalHookLocation == HookLocation.Left) {
      labelAnchor = "left";
      rectX = text.x() as number;
    } else if (this.horizontalHookLocation == HookLocation.Center) {
      labelAnchor = "middle";
      rectX = (text.x() as number) - (boxWidth + 2) / 2;
    } else if (this.horizontalHookLocation == HookLocation.Right) {
      labelAnchor = "end";
      rectX = (text.x() as number) - boxWidth;
    }

    if (this.verticalHookLocation == HookLocation.Center) {
      textY = (text.y() as number) - (boxHeight * 1.2) / 2;
      rectY = textY + boxHeight * 0.2;
    } else if (this.verticalHookLocation == HookLocation.Top) {
      textY -= boxHeight / 4;
      rectY = textY + boxHeight * 0.2;
    } else if (this.verticalHookLocation == HookLocation.Bottom) {
      textY -= boxHeight;
      rectY = textY + boxHeight * 0.2; // + (boxHeight / 2);
    }

    text.move(textX, textY);
    text.font({ anchor: labelAnchor });

    if (this.segmentFillColor != null) {
      text.fill(getContrastTextColor(this.segmentFillColor));
    } else {
      label
        .rect(boxWidth + 2, boxHeight * 0.8)
        .stroke(background)
        .fill(background)
        .opacity(0.9)
        .move(rectX - 1, rectY)
        .insertBefore(text);
    }

    return text;
  }

  private createElementID(prefix: string, groupPrefix: string) {
    return prefix + "_" + groupPrefix + "_" + this.ID_SCENARIOLABEL;
  }
}
