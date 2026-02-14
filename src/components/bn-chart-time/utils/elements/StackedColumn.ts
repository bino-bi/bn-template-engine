import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { DataPoint } from "../model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { HookLocation, Label } from "./Label";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { SVGStyle } from "../../../../utils/model";
import { StackMode } from "../../../../utils/constants";
import { Formatter } from "../../../../utils";

/**
 * IBCS grayscale palette for stacking by data dimension.
 * Used when stacking by category/subcategory/rowgroup.
 */
const GRAYSCALE_FILLS = ['#000000', '#555555', '#999999', '#bbbbbb', '#dddddd'];
const GRAYSCALE_STROKES = ['#000000', '#333333', '#777777', '#999999', '#bbbbbb'];

export class StackedColumn {

  private readonly position: ElementPositions;
  private readonly styles: TimeChartStyle;
  private readonly group: G;
  private readonly columnGroup: G;

  private readonly dataPoint: DataPoint;
  private readonly index: number;
  private readonly baselineValue: number;
  private readonly segmentLabel: string | null;
  private readonly segmentIndex: number;
  private readonly stackMode: StackMode;
  private readonly totalValue: number;
  private readonly isScenarioStack: boolean;

  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: TimeChartStyle,
    dataPoint: DataPoint,
    index: number,
    baselineValue: number,
    segmentLabel: string | null,
    segmentIndex: number,
    stackMode: StackMode,
    totalValue: number,
    isScenarioStack: boolean,
    parentGroup: G,
  ) {
    this.position = position;
    this.styles = styles;
    this.dataPoint = dataPoint;
    this.index = index;
    this.baselineValue = baselineValue;
    this.segmentLabel = segmentLabel;
    this.segmentIndex = segmentIndex;
    this.stackMode = stackMode;
    this.totalValue = totalValue;
    this.isScenarioStack = isScenarioStack;
    this.group = parentGroup;
    this.columnGroup = parentGroup.group().id(`stacked_col_${index}_seg_${segmentIndex}`);

    if (dataPoint?.isEmpty() !== true && dataPoint.value != null) {
      this.hasData = true;
    }
  }

  public draw(dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 }, _measureScale: SiPrefix = new SiPrefix()): void {
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

    // Get fill/stroke based on stacking type
    let fillStyle: any;
    let strokeStyle: any;

    if (this.isScenarioStack) {
      const scenarioStyle: SVGStyle | undefined = this.styles.barStyles[this.dataPoint.getScenario() as string];
      fillStyle = this.getFillStyle(scenarioStyle);
      strokeStyle = this.getStrokeStyle(scenarioStyle);
    } else {
      // Grayscale palette for dimension stacking
      const colorIdx = Math.min(this.segmentIndex, GRAYSCALE_FILLS.length - 1);
      fillStyle = { color: GRAYSCALE_FILLS[colorIdx] };
      strokeStyle = { color: GRAYSCALE_STROKES[colorIdx], width: 0.5 };
    }

    // Draw rectangle
    this.columnGroup.rect(columnWidth, Math.max(segmentHeight, 0.5))
      .fill(fillStyle)
      .stroke(strokeStyle)
      .y(yPos)
      .cx(xPos);

    // Draw segment label if segment is tall enough (min ~18px)
    const MIN_SEGMENT_HEIGHT_FOR_LABEL = 18;
    if (segmentHeight >= MIN_SEGMENT_HEIGHT_FOR_LABEL && this.segmentLabel != null) {
      const labelY = yPos + segmentHeight / 2;
      let labelValue: string;

      if (this.stackMode === StackMode.RELATIVE || this.stackMode === StackMode.ABSOLUTE_RELATIVE) {
        // Show percentage
        const pct = this.totalValue !== 0 ? (value / this.totalValue) * 100 : 0;
        labelValue = pct.toFixed(dataFormatDigits.decimal) + '%';
      } else {
        labelValue = Formatter.number(value, 'decimal', dataFormatDigits.decimal, dataFormatDigits.decimal);
      }

      new Label(
        this.group, xPos, labelY, 'STACK_SEG',
        labelValue, this.styles,
        HookLocation.Center, HookLocation.Center
      ).forceStringTypeDraw();
    }
  }

  /**
   * Draw the total label above the topmost segment.
   */
  public drawTotalLabel(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix()
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
      this.group, xPos, labelY, 'STACK_TOTAL',
      this.totalValue, this.styles,
      HookLocation.Bottom, HookLocation.Center
    );
    label.draw(true, dataFormatDigits, measureScale);
  }

  private getFillStyle(scenarioStyle: SVGStyle | undefined): any {
    if (!scenarioStyle) {
      return { color: '#000000' };
    }

    const pattern = this.styles.barStyles[this.dataPoint.getScenario() as string];
    if (pattern?.fillpattern && this.styles.pattern.get(pattern.fillpattern)?.pattern) {
      return this.styles.pattern.get(pattern.fillpattern)?.pattern;
    }

    return { color: scenarioStyle.fill || '#000000' };
  }

  private getStrokeStyle(scenarioStyle: SVGStyle | undefined): any {
    if (!scenarioStyle) {
      return { color: '#000000' };
    }
    return { color: scenarioStyle.stroke || '#000000' };
  }
}
