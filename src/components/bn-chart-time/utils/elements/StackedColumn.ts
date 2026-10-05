import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { DataPoint } from "../model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { HookLocation, Label } from "./Label";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { RELATIVE_STACK_UNITS, StackMode } from "../../../../utils/constants";
import { Formatter } from "../../../../utils/formatter";

/**
 * Renders a single segment within a stacked bar column in a time chart.
 *
 * Each StackedColumn represents one layer of the stack. It is positioned vertically
 * based on its cumulative baseline value and draws a colored rectangle.
 *
 * Supports three stacking modes:
 * - ABSOLUTE: segment height = value * pixelPerUnit
 * - RELATIVE (100%): segment height proportional to its share of totalValue
 * - ABSOLUTE_RELATIVE: same as absolute but labels show percentages
 *
 * Segment labels are shown only when the segment is tall enough (>= 18px) to avoid clutter.
 * The topmost segment can draw a total label above the full stack via drawTotalLabel().
 */
export class StackedColumn {
  private readonly position: ElementPositions;
  private readonly styles: TimeChartStyle;
  private readonly group: G;
  private readonly columnGroup: G;

  private readonly dataPoint: DataPoint;
  private readonly index: number;
  private readonly baselineValue: number;
  private readonly segmentIndex: number;
  private readonly stackMode: StackMode;
  private readonly totalValue: number;

  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: TimeChartStyle,
    dataPoint: DataPoint,
    index: number,
    baselineValue: number,
    _segmentLabel: string | null,
    segmentIndex: number,
    stackMode: StackMode,
    totalValue: number,
    _isScenarioStack: boolean,
    parentGroup: G,
  ) {
    this.position = position;
    this.styles = styles;
    this.dataPoint = dataPoint;
    this.index = index;
    this.baselineValue = baselineValue;
    this.segmentIndex = segmentIndex;
    this.stackMode = stackMode;
    this.totalValue = totalValue;
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
    if (!this.hasData || this.dataPoint.value == null) {
      return;
    }

    const value = this.dataPoint.value;
    const pixelPerUnit = this.dataPoint.pixelPerUnit;

    let segmentHeight: number;
    let yPos: number;
    const axisY = this.position.getColumnPositionY();

    if (this.stackMode === StackMode.RELATIVE) {
      // 100% stacked: segment height is proportion of total
      const proportion = this.totalValue !== 0 ? Math.abs(value) / Math.abs(this.totalValue) : 0;
      // Full stack spans RELATIVE_STACK_UNITS percent; pixelPerUnit = pixels per percentage point
      const totalPixelHeight = RELATIVE_STACK_UNITS * pixelPerUnit;
      segmentHeight = proportion * totalPixelHeight;
      const baselinePixels = (this.baselineValue / Math.abs(this.totalValue)) * totalPixelHeight;
      yPos = axisY - baselinePixels - segmentHeight;
    } else {
      // Absolute or absolute-relative: use real pixel scaling
      segmentHeight = Math.abs(value * pixelPerUnit);
      const baselinePixels = this.baselineValue * pixelPerUnit;
      yPos = axisY - baselinePixels - segmentHeight;
    }

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
        const share = this.totalValue !== 0 ? value / this.totalValue : 0;
        const labelValue = Formatter.number(
          share,
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
   * Draw the total label above the topmost segment.
   */
  public drawTotalLabel(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ): void {
    if (this.stackMode === StackMode.RELATIVE) {
      // Don't show total for 100% stacked (always 100%)
      return;
    }

    const xPos = this.position.getColumnCenterPositionX(this.index);
    const axisY = this.position.getColumnPositionY();
    const totalPixels = this.totalValue * this.dataPoint.pixelPerUnit;
    const labelY = axisY - totalPixels - this.position.spacings.labelToColumn;

    const label = new Label(
      this.group,
      xPos,
      labelY,
      "STACK_TOTAL",
      this.totalValue,
      this.styles,
      HookLocation.Bottom,
      HookLocation.Center,
    );
    label.draw(true, dataFormatDigits, measureScale);
  }
}
