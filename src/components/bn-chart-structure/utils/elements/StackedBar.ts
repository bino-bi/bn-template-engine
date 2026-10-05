import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { DataPoint, StructureChartStyle } from "../model";
import { HookLocation, Label } from "./Label";
import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { StackMode } from "../../../../utils/constants";
import { Formatter } from "../../../../utils/formatter";
import { StackLayout, StackSegment } from "../../../../utils/stackLayout";

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
  ) {
    this.position = position;
    this.styles = styles;
    this.dataPoint = dataPoint;
    this.index = index;
    this.segment = segment;
    this.segmentIndex = segmentIndex;
    this.stackMode = stackMode;
    this.stack = stack;
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
    const barWidth = this.position.getBarWidth();

    // a negative segment ends left of its start: the rect begins at the edge that is further left
    const segmentLength = Math.abs(this.segment.end - this.segment.start) * pixelPerUnit;
    const xPos = axisX + Math.min(this.segment.start, this.segment.end) * pixelPerUnit;

    const yPos = this.position.getBarPositionY(this.index, true);

    const colors = this.styles.stackColors;
    const fillColor = colors[this.segmentIndex % colors.length];
    const fillStyle = { color: fillColor };
    const strokeStyle = { color: fillColor, width: 0.5 };

    this.barGroup.rect(Math.max(segmentLength, 0.5), barWidth).fill(fillStyle).stroke(strokeStyle).cy(yPos).x(xPos);

    // Draw segment value label centered on bar if wide enough
    const LABEL_PADDING = 6;
    const availableWidth = segmentLength - LABEL_PADDING;
    if (availableWidth > 0) {
      const labelX = xPos + segmentLength / 2;

      if (this.stackMode === StackMode.RELATIVE || this.stackMode === StackMode.ABSOLUTE_RELATIVE) {
        const labelValue = Formatter.number(
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
          .setMaxWidth(availableWidth)
          .draw();
      } else {
        // Pass raw numeric value - Label.draw() formats with measureScale
        new Label(this.group, labelX, yPos, "STACK_SEG", value, this.styles, HookLocation.Center, HookLocation.Center)
          .setSegmentFill(fillColor)
          .setMaxWidth(availableWidth)
          .draw(dataFormatDigits, measureScale);
      }
    }
  }

  public drawTotalLabel(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ): void {
    if (this.stackMode === StackMode.RELATIVE) {
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
    label.draw(dataFormatDigits, measureScale);
  }
}
