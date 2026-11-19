import { G } from "@svgdotjs/svg.js";
import { StructureChartStyle } from "../model";
import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { Formatter } from "../../../../utils/formatter";
import { getContrastTextColor } from "../../../../utils/stackColors";
import { dataPointAttributes } from "../../../../utils/layoutState/dataPoint";
import { DataPointKey, DataPointPart } from "../../../../utils/layoutState/types";

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
  private maxWidth: number | null = null;
  private bold: boolean = false;
  private italic: boolean = false;

  readonly ID_SCENARIOLABEL: string = "Label";
  readonly CSS_CATEGORIES: string = "categories";
  private isRelativeLabel: boolean | undefined;

  private readonly verticalHookLocation: HookLocation;
  private readonly horizontalHookLocation: HookLocation;
  private pointKey?: DataPointKey;
  private pointPart: DataPointPart = "label";

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

  /** Bold for a sum row, italic for a rest row. */
  public setEmphasis(bold: boolean, italic: boolean): Label {
    this.bold = bold;
    this.italic = italic;
    return this;
  }

  public setMaxWidth(width: number): Label {
    this.maxWidth = width;
    return this;
  }

  /** The data row this label belongs to. Written on the label group when the label is drawn. */
  public setPoint(key: DataPointKey | undefined, part: DataPointPart = "label"): Label {
    this.pointKey = key;
    this.pointPart = part;
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

      valueStr = Formatter.number(Number(value), type, digits, digitsMin, scale, this.styles.locale);

      // a value that rounds to zero prints without a sign
      const zeroStr = Formatter.number(0, type, digits, digitsMin, scale, this.styles.locale);
      if (this.isVarianceLabel && Number(this.value) > 0 && valueStr !== zeroStr) {
        prefix = "+";
      }
      // only a value: a share, a category or a title comes as a string
      if (typeof this.value === "number" && !this.isVarianceLabel && !this.isRelativeLabel) {
        valueStr += this.styles.valueSuffix ?? "";
      }
    } else {
      valueStr = "" + this.value;
    }

    // @ts-ignore
    const text = label.text(prefix + valueStr);
    // bbox() of a detached label clones only the label into a sandbox, where the font of the SVG root is lost
    if (this.styles.fontStyles?.size) text.attr("font-size", this.styles.fontStyles.size);
    if (this.styles.fontStyles?.family) text.attr("font-family", this.styles.fontStyles.family);
    if (this.bold) text.font({ weight: "bold" });
    if (this.italic) text.font({ style: "italic" });
    text.move(this.x, this.y);

    // One bbox() per label, not two: svg.js caches nothing, and on a detached
    // tree each call clones the subtree into the document to measure it.
    const box = text.bbox();
    const boxWidth: number = box.w;
    const boxHeight: number = box.h;

    if (this.maxWidth != null && boxWidth > this.maxWidth) {
      this.group?.remove();
      this.group = null;
      return this;
    }

    // the hook says where the text is anchored: at its right, its middle or its left
    let labelAnchor = "start";
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

    if (this.pointKey) {
      label?.attr(dataPointAttributes(this.pointKey, this.pointPart));
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
