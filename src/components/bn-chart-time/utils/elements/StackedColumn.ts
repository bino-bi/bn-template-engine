import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { DataPoint } from "../model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { HookLocation, Label } from "./Label";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { StackMode } from "../../../../utils/constants";
import { Formatter } from "../../../../utils/formatter";
import { StackLayout, StackSegment } from "../../../../utils/stackLayout";

/**
 * Renders a single segment within a stacked bar column in a time chart.
 *
 * Each StackedColumn represents one layer of the stack. It draws a colored rectangle
 * at the place its laid-out segment has: positive values above the axis, negative below.
 *
 * Supports three stacking modes:
 * - ABSOLUTE: segment height = value * pixelPerUnit
 * - RELATIVE (100%): segment height proportional to its share of the stack
 * - ABSOLUTE_RELATIVE: same as absolute but labels show percentages
 *
 * Segment labels are shown only when the segment is tall enough (>= 18px) to avoid clutter.
 * The last segment can draw the total label of the full stack via drawTotalLabel().
 */
export class StackedColumn {
  private readonly position: ElementPositions;
  private readonly styles: TimeChartStyle;
  private readonly group: G;
  private readonly columnGroup: G;

  private readonly dataPoint: DataPoint;
  private readonly index: number;
  private readonly segment: StackSegment;
  private readonly segmentIndex: number;
  private readonly stackMode: StackMode;
  private readonly stack: StackLayout;

  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: TimeChartStyle,
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
    this.columnGroup = parentGroup.group().id(`stacked_col_${index}_seg_${segmentIndex}`);

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

    const axisY = this.position.getColumnPositionY();

    // y grows downward: the rect begins at the edge that is higher up, for a negative segment that is its start
    const segmentHeight = Math.abs(this.segment.end - this.segment.start) * pixelPerUnit;
    const yPos = axisY - Math.max(this.segment.start, this.segment.end) * pixelPerUnit;

    const xPos = this.position.getColumnCenterPositionX(this.index);
    const columnWidth = this.position.getColumnWidth();

    const colors = this.styles.stackColors;
    const fillColor = colors[this.segmentIndex % colors.length];
    const fillStyle = { color: fillColor };
    const strokeStyle = { color: fillColor, width: 0.5 };

    // Draw rectangle
    this.columnGroup
      .rect(columnWidth, Math.max(segmentHeight, 0.5))
      .fill(fillStyle)
      .stroke(strokeStyle)
      .y(yPos)
      .cx(xPos);

    // Draw segment value label if segment is tall enough (min ~18px)
    const MIN_SEGMENT_HEIGHT_FOR_LABEL = 18;
    if (segmentHeight >= MIN_SEGMENT_HEIGHT_FOR_LABEL) {
      const labelY = yPos + segmentHeight / 2;

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
          xPos,
          labelY,
          "STACK_SEG",
          labelValue,
          this.styles,
          HookLocation.Center,
          HookLocation.Center,
        )
          .setSegmentFill(fillColor)
          .forceStringTypeDraw();
      } else {
        // Pass raw numeric value - Label.draw() formats with measureScale
        new Label(this.group, xPos, labelY, "STACK_SEG", value, this.styles, HookLocation.Center, HookLocation.Center)
          .setSegmentFill(fillColor)
          .draw(true, dataFormatDigits, measureScale);
      }
    }
  }

  /**
   * Draw the signed total of the stack: above the positive side, or below the negative side for a negative total.
   */
  public drawTotalLabel(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ): void {
    if (this.stackMode === StackMode.RELATIVE) {
      // Don't show total for 100% stacked (always 100%)
      return;
    }

    // like a plain column: the label of a negative total hangs below the negative side
    const isNegative = this.stack.total < 0;
    const end = isNegative ? 0 - this.stack.negative : this.stack.positive;
    const xPos = this.position.getColumnCenterPositionX(this.index);
    const labelY = this.position.getColumnDataLabelPositionY(end * this.dataPoint.pixelPerUnit);

    const label = new Label(
      this.group,
      xPos,
      labelY,
      "STACK_TOTAL",
      this.stack.total,
      this.styles,
      isNegative ? HookLocation.Top : HookLocation.Bottom,
      HookLocation.Center,
    );
    label.draw(true, dataFormatDigits, measureScale);
  }
}
