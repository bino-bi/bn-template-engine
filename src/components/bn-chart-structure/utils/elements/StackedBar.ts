import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { DataPoint, StructureChartStyle } from "../model";
import { HookLocation, Label } from "./Label";
import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { SVGStyle } from "../../../../utils/model";
import { StackMode } from "../../../../utils/constants";
import { Formatter } from "../../../../utils";

const GRAYSCALE_FILLS = ['#000000', '#555555', '#999999', '#bbbbbb', '#dddddd'];
const GRAYSCALE_STROKES = ['#000000', '#333333', '#777777', '#999999', '#bbbbbb'];

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
  private readonly isScenarioStack: boolean;
  private readonly segmentLabel: string | null;

  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: StructureChartStyle,
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
    this.barGroup = parentGroup.group().id(`stacked_bar_${index}_seg_${segmentIndex}`);

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

    // Get fill/stroke
    let fillStyle: any;
    let strokeStyle: any;

    if (this.isScenarioStack) {
      const scenarioStyle: SVGStyle = this.styles.barStyles.getSVGStyle(this.dataPoint.getScenario());
      fillStyle = { color: scenarioStyle?.fill || '#000000' };
      strokeStyle = { color: scenarioStyle?.stroke || '#000000' };
    } else {
      const colorIdx = Math.min(this.segmentIndex, GRAYSCALE_FILLS.length - 1);
      fillStyle = { color: GRAYSCALE_FILLS[colorIdx] };
      strokeStyle = { color: GRAYSCALE_STROKES[colorIdx], width: 0.5 };
    }

    this.barGroup.rect(Math.max(segmentLength, 0.5), barWidth)
      .fill(fillStyle)
      .stroke(strokeStyle)
      .cy(yPos)
      .x(xPos);

    // Draw segment label if bar is wide enough
    const MIN_SEGMENT_WIDTH_FOR_LABEL = 30;
    if (segmentLength >= MIN_SEGMENT_WIDTH_FOR_LABEL && this.segmentLabel != null) {
      const labelX = xPos + segmentLength / 2;
      let labelValue: string;

      if (this.stackMode === StackMode.RELATIVE || this.stackMode === StackMode.ABSOLUTE_RELATIVE) {
        const pct = this.totalValue !== 0 ? (value / this.totalValue) * 100 : 0;
        labelValue = pct.toFixed(dataFormatDigits.decimal) + '%';
      } else {
        labelValue = Formatter.number(value, 'decimal', dataFormatDigits.decimal, dataFormatDigits.decimal);
      }

      new Label(
        this.group, labelX, yPos, 'STACK_SEG',
        labelValue, this.styles,
        HookLocation.Center, HookLocation.Center
      ).draw();
    }
  }

  public drawTotalLabel(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix()
  ): void {
    if (this.stackMode === StackMode.RELATIVE) {
      return;
    }

    const axisX = this.position.getBarPositionX();
    const totalPixels = this.totalValue * this.dataPoint.pixelPerUnit;
    const labelX = axisX + totalPixels + this.position.spacings.labelToBar;
    const yPos = this.position.getBarPositionY(this.index, true);

    const label = new Label(
      this.group, labelX, yPos, 'STACK_TOTAL',
      this.totalValue, this.styles,
      HookLocation.Center, HookLocation.Left
    );
    label.draw(dataFormatDigits, measureScale);
  }
}
