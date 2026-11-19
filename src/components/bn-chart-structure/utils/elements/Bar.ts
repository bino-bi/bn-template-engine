import { StructureChartStyle, DataPoint, StructureChartDimension, OverflowConfig } from "../model";
import { HookLocation, Label } from "./Label";

import { G } from "@svgdotjs/svg.js";
import { ElementPositions } from "../helper";
import { SVGPolgonPattern, SVGStyle } from "../../../../utils/model";
import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { SVGStyleGroup } from "../../../../utils/model/styles/SVGStyleGroup";
import { dataPointAttributes } from "../../../../utils/layoutState/dataPoint";
// import {HookLocation} from "../../../bn-chart-time-renderer/utils/elements";
// import {SVGPolgonPattern, SVGStyle} from "../../../../utils/model";
// import {SVGStyleGroup} from "../../../../utils/model/styles/SVGStyleGroup";
// import { DataFormatDigits } from "../../../../utils/model/DataFormatDigits";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";

/**
 * Renders a horizontal bar in an IBCS structure chart (the horizontal equivalent of Column).
 *
 * Positive values extend rightward from the vertical axis; negative values extend leftward.
 * Data labels are placed to the right of positive bars and to the left of negative bars.
 *
 * Overflow handling mirrors the Column's broken-bar algorithm but on the horizontal axis:
 * when a bar exceeds the effective cut width, it is split into a base segment and an
 * overdrive segment separated by vertical zigzag break indicators.
 *
 * Primary bars (AC foreground) carry data labels; secondary bars (PP background) do not.
 */
export class Bar {
  readonly ID_DATA_PREFIX: string = "DATA";
  readonly ID_SCENARIO_PREFIX: string = "SCENARIO";
  readonly ID_RECT: string = "RECT";
  readonly FALLBACK_COLOUR: string = "#000000";

  private dataPoint: DataPoint;
  // @ts-ignore
  private index: number;
  private readonly isPrimaryBar: boolean;
  private position: ElementPositions;
  private label: Label | null = null;
  private readonly scenarioGroup: G | null;
  private readonly barStyles: SVGStyleGroup;
  private readonly styles: StructureChartStyle;
  private readonly scenarioLabel: Label | null = null;
  private barGroup: G | null = null;
  private isVarianceBar: boolean = false;
  private overflowConfig: OverflowConfig | null = null;
  private isOverflowing: boolean = false;
  private overdriveWidth: number = 0;

  private dimensions: StructureChartDimension = {
    barLength: 0,
    xPos: 0,
    yPos: 0,
    labelXPos: 0,
    scenarioLabelXPos: 0,
    scenarioLabelYPos: 0,
    clipped: false,
  };
  private hasData: boolean = false;

  constructor(
    position: ElementPositions,
    styles: StructureChartStyle,
    dataPoint: DataPoint,
    index: number,
    isPrimaryBar: boolean,
    scenarioGroup: G,
    barLabel: string | null,
    overflowConfig: OverflowConfig | null = null,
  ) {
    this.dataPoint = dataPoint;
    this.index = index;
    this.isPrimaryBar = isPrimaryBar;
    this.position = position;
    this.barStyles = styles.barStyles;
    this.overflowConfig = overflowConfig;

    this.scenarioGroup = scenarioGroup;
    this.styles = styles;

    if (scenarioGroup != null) {
      this.barGroup = scenarioGroup.group().id(scenarioGroup.toString() + "_" + this.ID_RECT);
    }

    if (dataPoint?.isEmpty() !== true && dataPoint.value != null) {
      this.hasData = true;
      let textLabelHook = HookLocation.Left;
      if (dataPoint.value < 0) {
        textLabelHook = HookLocation.Right;
      }
      this.dimensions = this.createDimensions(position, dataPoint, index, isPrimaryBar);
      this.label = new Label(
        this.scenarioGroup,
        this.dimensions.labelXPos,
        this.dimensions.yPos,
        this.ID_DATA_PREFIX,
        dataPoint.value,
        this.styles,
        HookLocation.Center,
        textLabelHook,
      ).setPoint(dataPoint.key);
      this.scenarioLabel = this.getScenarioLabel(barLabel);
    }
  }

  public setAsVariance(): Bar {
    this.isVarianceBar = true;

    this.label?.setToVarianceLabel();

    return this;
  }

  public isRelativeVariance(): Bar {
    this.isVarianceBar = true;
    this.label?.setToRelativeVarianceLabel();
    return this;
  }

  public updateLabelGroup(newGroup: G | undefined): Bar {
    if (this.isEmpty() || newGroup == null) {
      return this;
    }

    this.label?.updateGroup(newGroup);
    return this;
  }

  public draw(
    dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 },
    measureScale: SiPrefix = new SiPrefix(),
  ) {
    if (this.isEmpty() || this.dataPoint.getScenario() == null) {
      return this;
    }

    // Bars default to barStyles (falls back to 'ac'); variance bars switch to varianceStyles below
    let scenarioStyle: SVGStyle = this.barStyles.getSVGStyle(this.dataPoint.getScenario());

    if (this.isVarianceBar) {
      scenarioStyle = this.styles.varianceStyles.getSVGStyle(this.dataPoint.getVarianceStyle());
    }

    const strokeStyle = this.convertToSVGStyle(scenarioStyle, "stroke");
    let fillStyle = this.convertToSVGStyle(scenarioStyle, "fill");
    const fillPattern: string | undefined = this.barStyles.getSVGStyle(this.dataPoint.getScenario()).fillpattern;

    if (fillPattern != null) {
      const polygonPattern: SVGPolgonPattern | undefined = this.styles.pattern.get(fillPattern);

      if (polygonPattern != null) {
        fillStyle = polygonPattern.pattern;
      }
    }

    this.scenarioGroup?.attr(dataPointAttributes(this.dataPoint.key));
    this.barGroup?.attr(dataPointAttributes(this.dataPoint.key, "element"));
    if (!this.isVarianceBar) this.barGroup?.attr("data-bn-value", this.dataPoint.value as number);

    if (this.barGroup != null) {
      if (this.isOverflowing && this.overflowConfig) {
        this.drawOverdriveBar(fillStyle, strokeStyle);
      } else {
        this.barGroup
          .rect(this.dimensions.barLength, this.position.getBarWidth())
          .fill(fillStyle)
          .stroke(strokeStyle)
          .cy(this.dimensions.yPos)
          .x(this.dimensions.xPos);
      }
    }
    this.drawBarDataLabel(dataFormatDigits, measureScale);
    this.drawScenarioLabel();
  }

  /** Draws a broken bar: base segment + break gap + overdrive segment (horizontal). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawOverdriveBar(fillStyle: any, strokeStyle: any): void {
    if (!this.barGroup || !this.overflowConfig) return;

    const axisX = this.position.getBarPositionX();
    const barHeight = this.position.getBarWidth();
    const effectiveCut = this.dimensions.barLength; // scenario-aware cut width
    const { breakGap } = this.overflowConfig;
    const isNegative = this.dataPoint.getScaledUnit() < 0;

    if (isNegative) {
      // Base bar: from axis leftward
      this.barGroup
        .rect(effectiveCut, barHeight)
        .fill(fillStyle)
        .stroke(strokeStyle)
        .x(axisX - effectiveCut)
        .cy(this.dimensions.yPos);

      // Overdrive bar: further left past the break gap
      this.barGroup
        .rect(this.overdriveWidth, barHeight)
        .fill(fillStyle)
        .stroke(strokeStyle)
        .x(axisX - effectiveCut - breakGap - this.overdriveWidth)
        .cy(this.dimensions.yPos);

      // Break indicator covers the full gap on top
      this.drawBreakIndicator(axisX - effectiveCut - breakGap, breakGap);
    } else {
      // Base bar: from axis rightward
      this.barGroup.rect(effectiveCut, barHeight).fill(fillStyle).stroke(strokeStyle).x(axisX).cy(this.dimensions.yPos);

      // Overdrive bar: further right past the break gap
      this.barGroup
        .rect(this.overdriveWidth, barHeight)
        .fill(fillStyle)
        .stroke(strokeStyle)
        .x(axisX + effectiveCut + breakGap)
        .cy(this.dimensions.yPos);

      // Break indicator covers the full gap on top
      this.drawBreakIndicator(axisX + effectiveCut, breakGap);
    }
  }

  /** Draws left and right vertical zigzag lines to indicate a broken axis (horizontal bars). */
  private drawBreakIndicator(breakX: number, breakGap: number): void {
    if (!this.barGroup) return;

    const barHeight = this.position.getBarWidth();
    const yTop = this.dimensions.yPos - barHeight / 2;
    const midX = breakX + breakGap / 2;
    const halfGap = breakGap * 0.35;
    const zigCount = 3;
    const segHeight = barHeight / zigCount;

    // Left zigzag line
    let leftPath = `M ${midX - halfGap} ${yTop}`;
    for (let i = 0; i < zigCount; i++) {
      const y1 = yTop + segHeight * (i + 0.5);
      const y2 = yTop + segHeight * (i + 1);
      const xPeak = midX - halfGap - breakGap * 0.3;
      leftPath += ` L ${xPeak} ${y1} L ${midX - halfGap} ${y2}`;
    }

    // Right zigzag line
    let rightPath = `M ${midX + halfGap} ${yTop}`;
    for (let i = 0; i < zigCount; i++) {
      const y1 = yTop + segHeight * (i + 0.5);
      const y2 = yTop + segHeight * (i + 1);
      const xPeak = midX + halfGap + breakGap * 0.3;
      rightPath += ` L ${xPeak} ${y1} L ${midX + halfGap} ${y2}`;
    }

    // White background covers the full break gap (bar edges provide background for peaks)
    this.barGroup
      .rect(breakGap, barHeight + 2)
      .fill("#ffffff")
      .stroke("none")
      .x(breakX)
      .cy(this.dimensions.yPos);

    this.barGroup.path(leftPath).fill("none").stroke({ color: "#000000", width: 1 });

    this.barGroup.path(rightPath).fill("none").stroke({ color: "#000000", width: 1 });
  }

  /**
   * Computes the pixel geometry for the bar: position, length, label anchors.
   * Handles three cases: overflow (broken bar), negative value, and normal positive.
   */
  private createDimensions(
    position: ElementPositions,
    dataPoint: DataPoint,
    index: number,
    isPrimaryBar: boolean,
  ): StructureChartDimension {
    const scaledUnit = dataPoint.getScaledUnit();
    const absScaledUnit = Math.abs(scaledUnit);

    // Check for overdrive overflow
    if (this.overflowConfig && absScaledUnit > 0) {
      const isAC = dataPoint.getScenario() === "ac";
      const effectiveCut = isAC
        ? this.overflowConfig.cutWidth
        : this.overflowConfig.cutWidth - this.overflowConfig.scenarioCutOffset;

      if (absScaledUnit > effectiveCut) {
        this.isOverflowing = true;
        const { breakGap, overdriveZoneWidth, maxOverflow } = this.overflowConfig;
        const overflowAmount = absScaledUnit - effectiveCut;
        this.overdriveWidth = maxOverflow > 0 ? (overflowAmount / maxOverflow) * overdriveZoneWidth : 0;

        const totalVisualWidth = effectiveCut + breakGap + this.overdriveWidth;

        if (scaledUnit < 0) {
          return {
            clipped: false,
            barLength: effectiveCut,
            xPos: position.getBarPositionX() - effectiveCut,
            yPos: position.getBarPositionY(index, isPrimaryBar),
            labelXPos: position.getLabelPositionX(-totalVisualWidth),
            scenarioLabelXPos: position.getBarPositionX() - effectiveCut * 0.5,
            scenarioLabelYPos:
              position.getBarPositionY(index, isPrimaryBar) + position.getScenarioLabelPositionOffsetY(isPrimaryBar),
          };
        } else {
          return {
            clipped: false,
            barLength: effectiveCut,
            xPos: position.getBarPositionX(),
            yPos: position.getBarPositionY(index, isPrimaryBar),
            labelXPos: position.getLabelPositionX(totalVisualWidth),
            scenarioLabelXPos: position.getBarPositionX() + effectiveCut * 0.5,
            scenarioLabelYPos:
              position.getBarPositionY(index, isPrimaryBar) + position.getScenarioLabelPositionOffsetY(isPrimaryBar),
          };
        }
      }
    }

    if (scaledUnit < 0) {
      return {
        clipped: false,
        barLength: absScaledUnit,
        xPos: position.getBarPositionX() + scaledUnit,
        yPos: position.getBarPositionY(index, isPrimaryBar),
        labelXPos: this.position.getLabelPositionX(scaledUnit),
        scenarioLabelXPos: this.position.getBarPositionX() - absScaledUnit * 0.5,
        scenarioLabelYPos:
          this.position.getBarPositionY(index, isPrimaryBar) +
          this.position.getScenarioLabelPositionOffsetY(isPrimaryBar),
      };
    } else {
      return {
        clipped: false,
        barLength: scaledUnit,
        xPos: position.getBarPositionX(),
        yPos: position.getBarPositionY(index, isPrimaryBar),
        labelXPos: this.position.getLabelPositionX(scaledUnit),
        scenarioLabelXPos: this.position.getBarPositionX() + absScaledUnit * 0.5,
        scenarioLabelYPos:
          this.position.getBarPositionY(index, isPrimaryBar) +
          this.position.getScenarioLabelPositionOffsetY(isPrimaryBar),
      };
    }
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
    if (this.scenarioLabel != null && !this.scenarioLabel.isEmpty() && !this.isVarianceBar) {
      this.scenarioLabel.setPos(this.dimensions.scenarioLabelXPos, this.dimensions.scenarioLabelYPos).draw();
    }
  }

  private drawBarDataLabel(dataFormatDigits: DataFormatDigits, measureScale: SiPrefix = new SiPrefix()) {
    if (this.isPrimaryBar) {
      this.label?.draw(dataFormatDigits, measureScale);
    }
  }

  private isEmpty(): boolean {
    return false === this.hasData || Number.isNaN(this.dataPoint.value);
  }

  private getScenarioLabel(barLabel: string | null) {
    if (this.isPrimaryBar) {
      return new Label(
        this.scenarioGroup,
        -1,
        -1,
        this.ID_SCENARIO_PREFIX,
        barLabel,
        this.styles,
        HookLocation.Top,
        HookLocation.Center,
      );
    }

    return new Label(
      this.scenarioGroup,
      -1,
      -1,
      this.ID_SCENARIO_PREFIX,
      barLabel,
      this.styles,
      HookLocation.Bottom,
      HookLocation.Center,
    );
  }
}
