import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { DataPoint, StructureChartStyle } from "../model";
import { HookLocation, Label } from "./Label";
import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { StackMode } from "../../../../utils/constants";
import { getStackFill, getStackStroke } from "../../../../utils/stackColors";

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
  private readonly baselineValue: number;
  private readonly segmentIndex: number;
  private readonly stackMode: StackMode;
  private readonly totalValue: number;
  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: StructureChartStyle,
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
    this.barGroup = parentGroup.group().id(`stacked_bar_${index}_seg_${segmentIndex}`);

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
    const axisX = this.position.getBarPositionX();
    const barWidth = this.position.getBarWidth();

    let segmentLength: number;
    let xPos: number;

    if (this.stackMode === StackMode.RELATIVE) {
      const proportion = this.totalValue !== 0 ? Math.abs(value) / Math.abs(this.totalValue) : 0;
      const totalPixelLength = pixelPerUnit;
      segmentLength = proportion * totalPixelLength;
      const baselinePixels = (this.baselineValue / Math.abs(this.totalValue)) * totalPixelLength;
      xPos = axisX + baselinePixels;
    } else {
      segmentLength = Math.abs(value * pixelPerUnit);
      const baselinePixels = this.baselineValue * pixelPerUnit;
      xPos = axisX + baselinePixels;
    }

    const yPos = this.position.getBarPositionY(this.index, true);

    // Unified IBCS 3-color palette for all stacking modes
    const fillColor = getStackFill(this.segmentIndex);
    const fillStyle = { color: fillColor };
    const strokeStyle = { color: getStackStroke(this.segmentIndex), width: 0.5 };

    this.barGroup.rect(Math.max(segmentLength, 0.5), barWidth).fill(fillStyle).stroke(strokeStyle).cy(yPos).x(xPos);

    // Draw segment value label centered on bar if wide enough
    const MIN_SEGMENT_WIDTH_FOR_LABEL = 30;
    if (segmentLength >= MIN_SEGMENT_WIDTH_FOR_LABEL) {
      const labelX = xPos + segmentLength / 2;

      if (this.stackMode === StackMode.RELATIVE || this.stackMode === StackMode.ABSOLUTE_RELATIVE) {
        const pct = this.totalValue !== 0 ? (value / this.totalValue) * 100 : 0;
        const labelValue = pct.toFixed(dataFormatDigits.percent) + "%";
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
          .draw();
      } else {
        // Pass raw numeric value — Label.draw() formats with measureScale
        new Label(this.group, labelX, yPos, "STACK_SEG", value, this.styles, HookLocation.Center, HookLocation.Center)
          .setSegmentFill(fillColor)
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

    const axisX = this.position.getBarPositionX();
    const totalPixels = this.totalValue * this.dataPoint.pixelPerUnit;
    const labelX = axisX + totalPixels + this.position.spacings.labelToBar;
    const yPos = this.position.getBarPositionY(this.index, true);

    const label = new Label(
      this.group,
      labelX,
      yPos,
      "STACK_TOTAL",
      this.totalValue,
      this.styles,
      HookLocation.Center,
      HookLocation.Left,
    );
    label.draw(dataFormatDigits, measureScale);
  }
}
