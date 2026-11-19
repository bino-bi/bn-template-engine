import { DataPoint, TimeChartDimension } from "../model";
import { HookLocation, Label } from "./Label";

import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
// import {
//   SVGStyle,
// } from "../../../../utils/model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { DataFormatDigits } from "../../../../components";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { SVGStyle } from "../../../../utils/model";
import { OverflowConfig } from "../model/OverflowConfig";
import { dataPointAttributes } from "../../../../utils/layoutState/dataPoint";
// import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";

/**
 * Renders a vertical bar (column) in an IBCS time chart.
 *
 * Coordinate system: SVG Y-axis is inverted -- positive values grow upward from the
 * axis baseline, so yPos decreases as value increases. Negative values extend downward.
 *
 * Overflow handling: When a bar exceeds the available chart height (determined by
 * OverflowConfig), the bar is split into a base segment and an overdrive segment
 * separated by a zigzag break indicator. The overdrive zone maps the overflow amount
 * proportionally into a fixed pixel region so all overflowing bars remain comparable.
 *
 * Primary columns (AC foreground) carry data labels and scenario labels;
 * secondary columns (PP background) render without labels by default.
 */
export class Column {
  private readonly ID_DATA_PREFIX: string = "DATA";
  private readonly ID_SCENARIO_PREFIX: string = "SCENARIO";
  private readonly ID_RECT: string = "RECT";
  private readonly FALLBACK_COLOUR: string = "#000000";
  private readonly isPrimaryColumn: boolean;
  private readonly scenarioGroup: G;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly columnBarStyles: any;
  private dataPoint: DataPoint;
  private readonly styles: TimeChartStyle;
  // @ts-ignore
  private index: number;

  private position: ElementPositions;
  private label: Label | null = null;

  private scenarioLabel: Label | null = null;
  private columnGroup: G | null;
  private isVarianceColumn: boolean = false;
  private overflowConfig: OverflowConfig | null = null;
  private isOverflowing: boolean = false;
  private overdriveHeight: number = 0;

  private dimensions: TimeChartDimension = {
    columnLength: 0,
    xPos: 0,
    yPos: 0,
    labelYPos: 0,
    scenarioLabelXPos: 0,
    scenarioLabelYPos: 0,
    clipped: false,
  };

  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: TimeChartStyle,
    dataPoint: DataPoint,
    index: number,
    isPrimaryColumn: boolean,
    scenarioGroup: G,
    columnLabel: string | null,
    overflowConfig: OverflowConfig | null = null,
  ) {
    this.dataPoint = dataPoint;
    this.index = index;
    this.isPrimaryColumn = isPrimaryColumn;
    this.position = position;
    this.columnBarStyles = styles.barStyles;
    this.overflowConfig = overflowConfig;

    this.scenarioGroup = scenarioGroup;
    this.styles = styles;

    this.columnGroup = scenarioGroup.group().id(scenarioGroup.toString() + "_" + this.ID_RECT);

    if (dataPoint?.isEmpty() !== true) {
      this.hasData = true;
      this.dimensions = this.createDimensions(dataPoint, index, isPrimaryColumn);
      this.label = this.getDataLabel(dataPoint);
      this.scenarioLabel = this.getScenarioLabel(columnLabel);
    }
  }

  public setAsVariance(): Column {
    this.isVarianceColumn = true;
    this.label?.setToVarianceLabel();
    return this;
  }

  public updateLabelGroup(newGroup: G): Column {
    if (this.isEmpty()) {
      return this;
    }

    this.label?.updateGroup(newGroup);
    return this;
  }

  public draw(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ) {
    // TODE: JHE: Remove DataFOrmatDigits Type Duplicates
    if (this.isEmpty()) {
      return this;
    }

    const scenarioStyle: SVGStyle | undefined = this.getScenarioStyle();
    let strokeStyle = this.convertToSVGStyle(scenarioStyle, "stroke");
    let fillStyle = this.getFillStyle(scenarioStyle);

    if (this.isVarianceColumn && this.dataPoint.notation === "pl") {
      // outlined like a plan column: the colour of the variance on the edge only
      const planWidth = Number(this.columnBarStyles?.pl?.width);
      strokeStyle = { color: scenarioStyle?.fill || this.FALLBACK_COLOUR, width: planWidth > 0 ? planWidth : 1 };
      fillStyle = this.styles.fontStyles.background || "#ffffff";
    }

    this.scenarioGroup.attr(dataPointAttributes(this.dataPoint.key));
    this.columnGroup?.attr(dataPointAttributes(this.dataPoint.key, "element"));
    if (this.dataPoint.key && Number.isFinite(this.dataPoint.value)) {
      this.columnGroup?.attr("data-bn-value", this.dataPoint.value as number);
    }

    if (this.columnGroup != null) {
      if (this.isOverflowing && this.overflowConfig) {
        this.drawOverdriveBar(fillStyle, strokeStyle);
      } else {
        this.columnGroup
          .rect(this.position.getColumnWidth(), this.dimensions.columnLength)
          .fill(fillStyle)
          .stroke(strokeStyle)
          .y(this.dimensions.yPos)
          .cx(this.dimensions.xPos);
      }
    }
    this.drawColumnDataLabel(dataFormatDigits, measureScale);
    this.drawScenarioLabel();
  }

  /**
   * Draws a broken bar: base segment + break gap + overdrive segment.
   * The break gap is filled with a white background and zigzag lines.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawOverdriveBar(fillStyle: any, strokeStyle: any): void {
    if (!this.columnGroup || !this.overflowConfig) return;

    const axisY = this.position.getColumnPositionY();
    const colWidth = this.position.getColumnWidth();
    const effectiveCut = this.dimensions.columnLength; // scenario-aware cut height
    const { breakGap } = this.overflowConfig;

    // Base bar: from axis up to effective cut height
    const baseY = axisY - effectiveCut;
    this.columnGroup.rect(colWidth, effectiveCut).fill(fillStyle).stroke(strokeStyle).y(baseY).cx(this.dimensions.xPos);

    // Overdrive bar: above the break gap
    const overdriveY = baseY - breakGap - this.overdriveHeight;
    this.columnGroup
      .rect(colWidth, this.overdriveHeight)
      .fill(fillStyle)
      .stroke(strokeStyle)
      .y(overdriveY)
      .cx(this.dimensions.xPos);

    // Break indicator: zigzag lines across bar width
    this.drawBreakIndicator(baseY, breakGap);
  }

  /** Draws top and bottom zigzag lines across the column width to indicate a broken axis. */
  private drawBreakIndicator(baseY: number, breakGap: number): void {
    if (!this.columnGroup) return;

    const colWidth = this.position.getColumnWidth();
    const xLeft = this.dimensions.xPos - colWidth / 2;
    const midY = baseY - breakGap / 2;
    const halfGap = breakGap * 0.35;
    const zigCount = 3;
    const segWidth = colWidth / zigCount;

    // Top zigzag line
    let topPath = `M ${xLeft} ${midY - halfGap}`;
    for (let i = 0; i < zigCount; i++) {
      const x1 = xLeft + segWidth * (i + 0.5);
      const x2 = xLeft + segWidth * (i + 1);
      const yPeak = midY - halfGap - breakGap * 0.3;
      topPath += ` L ${x1} ${yPeak} L ${x2} ${midY - halfGap}`;
    }

    // Bottom zigzag line
    let bottomPath = `M ${xLeft} ${midY + halfGap}`;
    for (let i = 0; i < zigCount; i++) {
      const x1 = xLeft + segWidth * (i + 0.5);
      const x2 = xLeft + segWidth * (i + 1);
      const yPeak = midY + halfGap + breakGap * 0.3;
      bottomPath += ` L ${x1} ${yPeak} L ${x2} ${midY + halfGap}`;
    }

    // White background to cover the bar behind the break
    this.columnGroup
      .rect(colWidth + 2, breakGap)
      .fill("#ffffff")
      .stroke("none")
      .y(baseY - breakGap)
      .cx(this.dimensions.xPos);

    this.columnGroup.path(topPath).fill("none").stroke({ color: "#000000", width: 1 });

    this.columnGroup.path(bottomPath).fill("none").stroke({ color: "#000000", width: 1 });
  }

  /**
   * Computes the pixel geometry for the column: position, height, label anchors.
   * Handles three cases: overflow (broken bar), negative value, and normal positive.
   * For overflow, the column is capped at effectiveCut height and an overdrive zone is added.
   */
  public createDimensions(dataPoint: DataPoint, index: number, isPrimaryBar: boolean): TimeChartDimension {
    const scaledUnit = dataPoint.getScaledUnit();

    // Determine effective cut height: AC scenarios use full cutHeight, others break lower
    if (this.overflowConfig && scaledUnit > 0) {
      const isAC = dataPoint.getScenario() === "ac";
      const effectiveCut = isAC
        ? this.overflowConfig.cutHeight
        : this.overflowConfig.cutHeight - this.overflowConfig.scenarioCutOffset;

      if (scaledUnit > effectiveCut) {
        this.isOverflowing = true;
        const { breakGap, overdriveZoneHeight, maxOverflow } = this.overflowConfig;
        const overflowAmount = scaledUnit - effectiveCut;
        this.overdriveHeight = maxOverflow > 0 ? (overflowAmount / maxOverflow) * overdriveZoneHeight : 0;

        const totalVisualHeight = effectiveCut + breakGap + this.overdriveHeight;
        const axisY = this.position.getColumnPositionY();

        return {
          clipped: false,
          columnLength: effectiveCut,
          xPos: this.position.getColumnPositionX(index, isPrimaryBar),
          yPos: axisY - effectiveCut,
          labelYPos: axisY - totalVisualHeight - this.position.spacings.labelToColumn,
          scenarioLabelXPos:
            this.position.getColumnPositionX(index, isPrimaryBar) +
            this.position.getScenarioLabelPositionOffsetX(isPrimaryBar),
          scenarioLabelYPos: axisY - effectiveCut * 0.5,
        };
      }
    }

    if (scaledUnit < 0) {
      return {
        clipped: false,
        columnLength: Math.abs(scaledUnit),
        xPos: this.position.getColumnPositionX(index, isPrimaryBar),
        yPos: this.position.getColumnPositionY(),
        labelYPos: this.position.getColumnDataLabelPositionY(scaledUnit),
        scenarioLabelXPos:
          this.position.getColumnPositionX(index, isPrimaryBar) +
          this.position.getScenarioLabelPositionOffsetX(isPrimaryBar),
        scenarioLabelYPos: this.position.getColumnPositionY() + Math.abs(scaledUnit) * 0.5,
      };
    } else {
      return {
        clipped: false,
        columnLength: scaledUnit,
        xPos: this.position.getColumnPositionX(index, isPrimaryBar),
        yPos: this.position.getColumnPositionY() - scaledUnit,
        labelYPos: this.position.getColumnDataLabelPositionY(scaledUnit),
        scenarioLabelXPos:
          this.position.getColumnPositionX(index, isPrimaryBar) +
          this.position.getScenarioLabelPositionOffsetX(isPrimaryBar),
        scenarioLabelYPos: this.position.getColumnPositionY() - Math.abs(scaledUnit) * 0.5,
      };
    }
  }

  private getDataLabel(dataPoint: DataPoint) {
    let labelHook = HookLocation.Bottom;
    if (dataPoint.value != null && dataPoint.value < 0) {
      labelHook = HookLocation.Top;
    }

    const labelY = this.isOverflowing
      ? this.dimensions.labelYPos
      : this.position.getColumnDataLabelPositionY(this.dataPoint.getScaledUnit());

    return new Label(
      this.scenarioGroup,
      this.position.getColumnCenterPositionX(this.index),
      labelY,
      this.ID_DATA_PREFIX,
      dataPoint.value,
      this.styles,
      labelHook,
      HookLocation.Center,
    ).setPoint(dataPoint.key);
  }

  private getScenarioLabel(columnLabel: string | null) {
    if (this.isPrimaryColumn) {
      return new Label(
        this.scenarioGroup,
        -1,
        -1,
        this.ID_SCENARIO_PREFIX,
        columnLabel,
        this.styles,
        HookLocation.Center,
        HookLocation.Left,
      );
    }

    return new Label(
      this.scenarioGroup,
      -1,
      -1,
      this.ID_SCENARIO_PREFIX,
      columnLabel,
      this.styles,
      HookLocation.Center,
      HookLocation.Right,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertToSVGStyle(style: any, mode: string): any {
    if (style == null) {
      style = [];
    }
    style["color"] = style[mode] || this.FALLBACK_COLOUR;
    return { ...style };
  }

  private drawScenarioLabel() {
    if (this.scenarioLabel != null && !this.scenarioLabel.isEmpty() && !this.isVarianceColumn) {
      this.scenarioLabel.setPos(this.dimensions.scenarioLabelXPos, this.dimensions.scenarioLabelYPos).draw(true);
    }
  }

  private drawColumnDataLabel(dataFormatDigits: DataFormatDigits, measureScale: SiPrefix = new SiPrefix()) {
    this.label?.draw(this.isPrimaryColumn, dataFormatDigits, measureScale);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getFillStyle(scenarioStyle: SVGStyle | undefined): any {
    const pattern = this.columnBarStyles[this.dataPoint.getScenario() as string];

    if (pattern?.fillpattern && this.styles.pattern.get(pattern.fillpattern)?.pattern) {
      return this.styles?.pattern?.get(pattern.fillpattern)?.pattern;
    }

    return this.convertToSVGStyle(scenarioStyle, "fill");
  }

  private getScenarioStyle(): SVGStyle | undefined {
    if (this.isVarianceColumn) {
      return this.styles?.varianceStyles.getSVGStyle(this.dataPoint.getVarianceStyle());
    }

    return this.columnBarStyles[this.dataPoint.getScenario() as string];
  }

  private isEmpty(): boolean {
    return false === this.hasData || Number.isNaN(this.dataPoint.value);
  }
}
