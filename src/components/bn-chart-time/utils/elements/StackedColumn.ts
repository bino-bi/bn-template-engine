import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { DataPoint } from "../model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { HookLocation, Label } from "./Label";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { StackMode } from "../../../../utils/constants";
import { getStackFill, getStackStroke } from "../../../../utils/stackColors";

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
      // Use a fixed total height based on pixelPerUnit (total=1.0 for 100%)
      const totalPixelHeight = pixelPerUnit; // pixelPerUnit represents the height for 100%
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

    // Unified IBCS 3-color palette for all stacking modes
    const fillColor = getStackFill(this.segmentIndex);
    const fillStyle = { color: fillColor };
    const strokeStyle = { color: getStackStroke(this.segmentIndex), width: 0.5 };

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
        const pct = this.totalValue !== 0 ? (value / this.totalValue) * 100 : 0;
        const labelValue = pct.toFixed(dataFormatDigits.percent) + "%";
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
        // Pass raw numeric value — Label.draw() formats with measureScale
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
