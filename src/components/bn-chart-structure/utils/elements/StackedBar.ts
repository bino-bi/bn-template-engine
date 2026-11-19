import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { DataPoint, StructureChartStyle } from "../model";
import { HookLocation, Label } from "./Label";
import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { StackMode } from "../../../../utils/constants";
import { Formatter } from "../../../../utils/formatter";
import { StackLayout, StackSegment } from "../../../../utils/stackLayout";
import { dataPointAttributes } from "../../../../utils/layoutState/dataPoint";
import { DataPointKey } from "../../../../utils/layoutState/types";

/** What a segment prints: its share with a percent sign, its share as a plain number, or its value. */
export type StackLabel = "share" | "plain-share" | "value";

/** Options of one segment that only some charts set. */
export interface StackedBarOptions {
  /** Label of a segment in mode `relative`. Default: `share`. */
  label?: StackLabel;
  /** A 100 % stack prints no total, unless this is set. */
  total?: boolean;
  bold?: boolean;
  italic?: boolean;
}

/**
 * Renders a single horizontal stacked bar segment for the structure chart.
 */
export class StackedBar {
  private readonly position: ElementPositions;
  private readonly styles: StructureChartStyle;
  private readonly group: G;
  private readonly barGroup: G;

  private readonly dataPoint: DataPoint;
  private readonly index: number;
  private readonly segment: StackSegment;
  private readonly segmentIndex: number;
  private readonly stackMode: StackMode;
  private readonly stack: StackLayout;
  private hasData: boolean = false;
  private readonly options: StackedBarOptions;

  constructor(
    position: ElementPositions,
    styles: StructureChartStyle,
    dataPoint: DataPoint,
    index: number,
    segment: StackSegment,
    _segmentLabel: string | null,
    segmentIndex: number,
    stackMode: StackMode,
    stack: StackLayout,
    _isScenarioStack: boolean,
    parentGroup: G,
    options: StackedBarOptions = {},
  ) {
    this.position = position;
    this.styles = styles;
    this.dataPoint = dataPoint;
    this.index = index;
    this.segment = segment;
    this.segmentIndex = segmentIndex;
    this.stackMode = stackMode;
    this.stack = stack;
    this.options = options;
    this.group = parentGroup;
    this.barGroup = parentGroup.group().id(`stacked_bar_${index}_seg_${segmentIndex}`);

    if (dataPoint?.isEmpty() !== true && dataPoint.value != null) {
      this.hasData = true;
    }
  }

  public draw(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ): void {
    // a segment without a value (NaN) keeps its place in the stack, so the colours stay, but draws nothing
    if (!this.hasData || !Number.isFinite(this.dataPoint.value)) {
      return;
    }

    const value = this.dataPoint.value;
    const pixelPerUnit = this.dataPoint.pixelPerUnit;
    const axisX = this.position.getBarPositionX();
    const barWidth = this.position.getBarWidthAt(this.index);

    // a negative segment ends left of its start: the rect begins at the edge that is further left
    const segmentLength = Math.abs(this.segment.end - this.segment.start) * pixelPerUnit;
    const xPos = axisX + Math.min(this.segment.start, this.segment.end) * pixelPerUnit;

    const yPos = this.position.getBarPositionY(this.index, true);

    const colors = this.styles.stackColors;
    const fillColor = colors[this.segmentIndex % colors.length];
    const fillStyle = { color: fillColor };
    const strokeStyle = { color: fillColor, width: 0.5 };

    this.barGroup.attr(dataPointAttributes(this.dataPoint.key, "element"));
    this.barGroup.attr("data-bn-value", value as number);
    this.barGroup.rect(Math.max(segmentLength, 0.5), barWidth).fill(fillStyle).stroke(strokeStyle).cy(yPos).x(xPos);

    // Draw segment value label centered on bar if wide enough
    // 6 px at the base font of 16 px, less with a smaller font
    const labelPadding = Math.min(6, this.styles.fontStyles.size * 0.375);
    const availableWidth = segmentLength - labelPadding;
    const { bold = false, italic = false } = this.options;
    const relative = this.stackMode === StackMode.RELATIVE || this.stackMode === StackMode.ABSOLUTE_RELATIVE;
    const labelKind: StackLabel = this.stackMode === StackMode.RELATIVE ? (this.options.label ?? "share") : "share";
    if (availableWidth > 0) {
      const labelX = xPos + segmentLength / 2;

      if (relative && labelKind !== "value") {
        const labelValue =
          labelKind === "plain-share"
            ? Formatter.number(
                this.segment.share * 100,
                "decimal",
                dataFormatDigits.percent,
                dataFormatDigits.percent,
                1,
                this.styles.locale,
              )
            : Formatter.number(
                this.segment.share,
                "percent",
                dataFormatDigits.percent,
                dataFormatDigits.percent,
                1,
                this.styles.locale,
              );
        new Label(
          this.group,
          labelX,
          yPos,
          "STACK_SEG",
          labelValue,
          this.styles,
          HookLocation.Center,
          HookLocation.Center,
        )
          .setSegmentFill(fillColor)
          .setEmphasis(bold, italic)
          .setMaxWidth(availableWidth)
          .setPoint(this.dataPoint.key)
          .draw();
      } else {
        // Pass raw numeric value - Label.draw() formats with measureScale
        new Label(this.group, labelX, yPos, "STACK_SEG", value, this.styles, HookLocation.Center, HookLocation.Center)
          .setSegmentFill(fillColor)
          .setEmphasis(bold, italic)
          .setMaxWidth(availableWidth)
          .setPoint(this.dataPoint.key)
          .draw(dataFormatDigits, measureScale);
      }
    }
  }

  public drawTotalLabel(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
    key?: DataPointKey,
  ): void {
    if (this.stackMode === StackMode.RELATIVE && !this.options.total) {
      return;
    }

    // like a plain bar: the label of a negative total sits left of the negative side
    const isNegative = this.stack.total < 0;
    const end = isNegative ? 0 - this.stack.negative : this.stack.positive;
    const labelX = this.position.getLabelPositionX(end * this.dataPoint.pixelPerUnit);
    const yPos = this.position.getBarPositionY(this.index, true);

    const label = new Label(
      this.group,
      labelX,
      yPos,
      "STACK_TOTAL",
      this.stack.total,
      this.styles,
      HookLocation.Center,
      isNegative ? HookLocation.Right : HookLocation.Left,
    );
    label
      .setEmphasis(this.options.bold ?? false, this.options.italic ?? false)
      .setPoint(key, "total")
      .draw(dataFormatDigits, measureScale);
  }
}
