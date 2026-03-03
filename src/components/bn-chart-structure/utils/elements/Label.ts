import { G } from "@svgdotjs/svg.js";
import { StructureChartStyle } from "../model";
import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { Formatter } from "../../../../utils/formatter";
import { getContrastTextColor } from "../../../../utils/stackColors";

// import {Formatter} from "../../../../utils";
// import {StructureChartStyle} from "../model";
// import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";

/**
 * Anchor point for label positioning relative to its coordinates (structure chart variant).
 * Vertical hooks shift the label up/down; horizontal hooks set SVG text-anchor alignment.
 */
export enum HookLocation {
  Left,
  Center,
  Right,
  Top,
  Bottom,
}

/**
 * SVG text label for structure chart elements (bars, needles, markers, axes).
 *
 * Handles numeric formatting via Formatter.number(), variance sign prefixing,
 * and hook-based positioning. Draws a semi-transparent white background rectangle
 * for readability, or uses contrast text color when placed inside stacked segments.
 *
 * Horizontal equivalent of the time chart Label class, adapted for horizontal bar layout.
 */
export class Label {
  private x: number;
  private y: number;
  private readonly value: number | string | null;

  private group: G | null = null;
  private styles: StructureChartStyle;

  private isVarianceLabel: boolean;
  private segmentFillColor: string | null = null;

  readonly ID_SCENARIOLABEL: string = "Label";
  readonly CSS_CATEGORIES: string = "categories";
  private isRelativeLabel: boolean | undefined;

  private readonly verticalHookLocation: HookLocation;
  private readonly horizontalHookLocation: HookLocation;

  constructor(
    parent: G | null,
    xPosition: number,
    yPosition: number,
    groupPrefix: string,
    value: number | string | null,
    styles: StructureChartStyle,
    verticalHookLocation: HookLocation,
    horizontalHookLocation: HookLocation,
  ) {
    this.x = xPosition;
    this.y = yPosition;
    this.value = value;

    if (parent != null) {
      this.group = parent.group().id(this.createElementID(parent.toString(), groupPrefix));
    }

    this.styles = styles;

    this.isVarianceLabel = false;
    this.isRelativeLabel = false;

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

  private createElementID(prefix: string, groupPrefix: string) {
    return prefix + "_" + groupPrefix + "_" + this.ID_SCENARIOLABEL;
  }

  public draw(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ): Label {
    if (this.isEmpty()) {
      return this;
    }

    const label = this.group;
    let valueStr: string;

    const background: string = this.styles.fontStyles.background || "#ffffff";

    let prefix = "";
    let labelAnchor = "start";

    if (Number.isNaN(Number(this.value)) === false) {
      let digits = dataFormatDigits.percent;
      let digitsMin = dataFormatDigits.percent;
      let scale = 1;
      const value = this.value;
      let type = "percent";

      if (this.isRelativeLabel === false) {
        digits = dataFormatDigits.decimal;
        digitsMin = dataFormatDigits.decimal;
        scale = measureScale.value;
        type = "decimal";
      }

      valueStr = Formatter.number(Number(value), type, digits, digitsMin, scale);

      if (Number(this.value) < 0) {
        labelAnchor = "end";
      }

      if (this.isVarianceLabel && Number(this.value) >= 0) {
        prefix = "+";
      }
    } else {
      valueStr = "" + this.value;
      labelAnchor = "start";
    }

    // @ts-ignore
    const text = label.text(prefix + valueStr);
    text.move(this.x, this.y);

    const boxWidth: number = text.bbox().w;
    const boxHeight: number = text.bbox().h;

    if (this.horizontalHookLocation === HookLocation.Right) {
      labelAnchor = "end";
      text.move((text.x() as number) - text.length(), text.y());
    } else if (this.horizontalHookLocation === HookLocation.Center) {
      labelAnchor = "middle";
      text.move((text.x() as number) - text.length() / 2, text.y());
    }

    if (this.verticalHookLocation === HookLocation.Center) {
      text.move(text.x() as number, (text.y() as number) - boxHeight / 2);
    } else if (this.verticalHookLocation === HookLocation.Bottom) {
      text.move(text.x() as number, (text.y() as number) - boxHeight);
    }

    text.font({ anchor: labelAnchor });

    if (this.segmentFillColor != null) {
      text.fill(getContrastTextColor(this.segmentFillColor));
    } else {
      label
        ?.rect(boxWidth, boxHeight * 0.9)
        .stroke(background)
        .fill(background)
        .opacity(0.7)
        .move(text.x(), (text.y() as number) + boxHeight * 0.1)
        .insertBefore(text);
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
}
