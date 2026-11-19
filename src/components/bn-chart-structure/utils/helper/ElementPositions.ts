import { Box, DataPoint, Point2D, ScaleFactorsStructureChart } from "../model";

import { Padding } from "./Padding";

/** Rows that are not all one `categoryWidth` high: start and height of each, in units of `categoryWidth`. */
export type RowLayout = {
  start: number[];
  weight: number[];
  total: number;
  /** A sum row follows the last bar: the name of the scenario stands right below that bar, not below the axis end. */
  nameBelowBar?: boolean;
};

/**
 * Spatial layout engine for the structure chart (horizontal bars).
 *
 * Converts logical data model coordinates (bar index, data values) into pixel positions
 * for all chart elements. All spacings are derived from the font size multiplied by
 * ScaleFactorsStructureChart factors.
 *
 * Key coordinate reference points:
 * - getBarPositionX(): the X coordinate of the vertical axis baseline
 * - getBarCenterPositionY(index): center Y for the bar at the given category index
 * - getAxisPositionX(): axis X accounting for left-side labels and padding
 *
 * The layout accounts for: padding, left-side label space (title, category names,
 * negative-value labels), scenario offsets, and marker positioning above/below bars.
 */
export class ElementPositions {
  categoryPosition: Point2D = { x: 0, y: 0 };
  axisPosition: Point2D;

  padding: Padding;
  scaleFactors: ScaleFactorsStructureChart;
  spacings: ScaleFactorsStructureChart = {
    scenarioOffset: 0,
    markerOffset: 0,
    scenarioLabelToBar: 0,
    labelToBar: 0,
    labelToAxis: 0,
    needleWidth: 0,
    needleHeadWidth: 0,
    barWidth: 0,
    varianceAxisLineWidth: 0,
    axisLineWidth: 0,
    auxiliaryLineWidth: 0,
    scenarioLineWidth: 0,
    markerWidth: 0,
    categoryWidth: 0,
    axisTickLength: 0,
  };

  categoriesBoxOffset: Box = {
    width: 0,
    height: 0,
  };
  fontSize: number;

  private numberOfColumns: number;
  private leftSideLengthSync: number;
  private leftSideLabelLength: number;
  private topSideLabelHeight: number;
  private hasStackedHeaders: boolean;
  /** Per row, in units of `categoryWidth`: where it starts below the axis top, and its height. */
  private rows: RowLayout | null;

  // private smallestDataPoint: DataPoint;

  constructor(
    padding: Padding,
    scaleFactors: ScaleFactorsStructureChart,
    fontSize: number,
    numberOfColumns: number,
    leftSideLengthSync: number,
    titleLength: number,
    leftSideWidth: number,
    categoryWidth: number,
    hasStackedHeaders: boolean = false,
    rows: RowLayout | null = null,
  ) {
    this.padding = padding;
    this.scaleFactors = scaleFactors;
    this.fontSize = fontSize;
    this.axisPosition = { x: 0, y: 0 };
    this.numberOfColumns = numberOfColumns;
    this.leftSideLengthSync = leftSideLengthSync;
    this.topSideLabelHeight = titleLength > 0 ? this.fontSize : 0;
    this.hasStackedHeaders = hasStackedHeaders;
    this.rows = rows;

    this.leftSideLabelLength = this.calculateSideLabelLength(titleLength, leftSideWidth, categoryWidth);
    this.calculateSpacings();
    this.calculateCategoryPosition();
    this.calculateAxisPosition();
  }

  public getBarPositionX(): number {
    return this.axisPosition.x;
  }

  public getBarCenterPositionY(index: number): number {
    if (this.rows && index < this.rows.start.length) {
      const middle = this.rows.start[index] + this.rows.weight[index] / 2;
      return this.getAxisPositionY() + this.spacings.scenarioOffset + middle * this.spacings.categoryWidth;
    }
    return this.categoryPosition.y + this.spacings.scenarioOffset + index * this.spacings.categoryWidth;
  }

  /** Upper edge of the room of a row. */
  public getRowTopPositionY(index: number): number {
    const start = this.rows && index < this.rows.start.length ? this.rows.start[index] : index;
    return this.getAxisPositionY() + this.spacings.scenarioOffset + start * this.spacings.categoryWidth;
  }

  /** Thickness of the bar of a row. Rows have one thickness unless the chart sets a row layout. */
  public getBarWidthAt(index: number): number {
    const weight = this.rows && index < this.rows.weight.length ? this.rows.weight[index] : 1;
    return this.spacings.barWidth * weight;
  }

  public getBarPositionY(index: number, isPrimaryMarker: boolean): number {
    if (isPrimaryMarker) {
      return this.getBarCenterPositionY(index);
    }

    return this.getBarCenterPositionY(index) - this.spacings.scenarioOffset;
  }

  public getCategoryPositionX(isPositive: boolean): number {
    let offset = this.spacings.labelToAxis;

    if (isPositive) {
      offset = -this.spacings.labelToAxis;
    }

    return this.getAxisPositionX() + offset;
  }

  public getAxisTitlePositionX(): number {
    return this.axisPosition.x;
  }

  public getAxisTitlePositionY(): number {
    return this.axisPosition.y - this.spacings.labelToAxis - this.getTopLabelOverhang();
  }

  public getStackedHeaderPositionY(): number {
    return this.getBarCenterPositionY(0) - this.getBarWidthAt(0) * 0.5 - this.spacings.scenarioLabelToBar;
  }

  getNeedleWidth() {
    return this.spacings.needleWidth;
  }

  public getAxisPositionX(): number {
    return this.leftSideLabelLength + this.padding.left + this.spacings.labelToAxis;
  }

  public getAxisPositionY(): number {
    return this.padding.top + this.getAxisTitleOffset();
  }

  public loadCategoriesBox(categoriesBoxOffset: Box) {
    this.categoriesBoxOffset = categoriesBoxOffset;
    this.calculateAxisPosition();
  }

  public addOffsetByNegativeDataPoints(
    smallestDataPoint: DataPoint,
    boxWidth: number,
    isPercent: boolean,
    titleLength: number,
  ) {
    if (smallestDataPoint != null && smallestDataPoint.value != null) {
      if (smallestDataPoint.value < 0) {
        if (isPercent && smallestDataPoint.isClipped()) {
          this.axisPosition.x += Math.abs(smallestDataPoint.getClippedValue() * smallestDataPoint.pixelPerUnit);
        } else {
          this.axisPosition.x += Math.abs(smallestDataPoint.value * smallestDataPoint.pixelPerUnit);
        }

        this.axisPosition.x += boxWidth;

        this.axisPosition.x += this.spacings.labelToBar;
      }
    }

    if (this.axisPosition.x < titleLength / 2) {
      this.axisPosition.x = titleLength / 2 + this.spacings.labelToBar;
    }
  }

  public getLabelPositionX(scaledUnit: number): number {
    let offset = this.spacings.labelToBar;
    if (scaledUnit < 0) {
      offset *= -1;
    }
    return this.axisPosition.x + scaledUnit + offset;
  }

  public getLabelPositionY(scaledUnit: number): number {
    return this.axisPosition.y + scaledUnit + this.spacings.labelToBar;
  }

  public getCategoryToAxisSpaceing(): number {
    return this.spacings.labelToAxis;
  }

  public getCategoryToTopSpaceing(): number {
    return this.spacings.scenarioOffset;
  }

  public getCategoryToBottomSpaceing(): number {
    return this.spacings.scenarioOffset; // this.categoryOffset;
  }

  getAxisEndPositionY() {
    const rows = this.rows ? this.rows.total : this.numberOfColumns;
    return this.getAxisPositionY() + (rows + 1 / 2) * this.spacings.categoryWidth;
  }

  getScenarioLabelPositionOffsetY(isPrimaryBar: boolean) {
    if (isPrimaryBar) {
      // The label belongs to the last bar, but the axis line runs past that bar's
      // center by (categoryWidth - scenarioOffset); place the label below the axis
      // end so the line does not strike through it.
      const belowBar = this.getBarWidth() * 0.5 + this.spacings.scenarioLabelToBar;
      if (this.rows?.nameBelowBar) return belowBar;
      const belowAxisEnd = this.spacings.categoryWidth - this.spacings.scenarioOffset + this.spacings.labelToAxis;
      return Math.max(belowBar, belowAxisEnd);
    }

    return -(this.getBarWidth() * 0.5 + this.spacings.scenarioLabelToBar);
  }

  getBarWidth() {
    return this.spacings.barWidth;
  }

  getMarkerPositionY(index: number, isPrimaryMarker: boolean) {
    if (isPrimaryMarker) {
      return this.getBarCenterPositionY(index) - this.spacings.markerOffset - this.getBarWidth() * 0.5;
    }
    return this.getBarCenterPositionY(index) + this.spacings.markerOffset + this.getBarWidth() * 0.5;
  }

  public getMarkerPositionX(): number {
    return this.getBarPositionX();
  }

  getMarkerScenarioLabelPositionOffsetY(isPrimaryColumn: boolean) {
    if (isPrimaryColumn) {
      return -(this.spacings.markerWidth * 0.5 + this.spacings.scenarioLabelToBar);
    }

    return this.spacings.scenarioLabelToBar + this.spacings.markerWidth * 0.5;
  }

  getAxisEndPositionX() {
    return this.getAxisPositionX();
  }

  private calculateSpacings() {
    this.spacings = {
      scenarioOffset: this.fontSize * this.scaleFactors.scenarioOffset,
      markerOffset: this.fontSize * this.scaleFactors.markerOffset,
      scenarioLabelToBar: this.fontSize * this.scaleFactors.scenarioLabelToBar,
      labelToBar: this.fontSize * this.scaleFactors.labelToBar,
      labelToAxis: this.fontSize * this.scaleFactors.labelToAxis,
      needleWidth: this.fontSize * this.scaleFactors.needleWidth,
      needleHeadWidth: this.fontSize * this.scaleFactors.needleHeadWidth,
      barWidth: this.fontSize * this.scaleFactors.barWidth,
      varianceAxisLineWidth: this.fontSize * this.scaleFactors.varianceAxisLineWidth,
      axisLineWidth: this.fontSize * this.scaleFactors.axisLineWidth,
      auxiliaryLineWidth: this.fontSize * this.scaleFactors.auxiliaryLineWidth,
      scenarioLineWidth: this.fontSize * this.scaleFactors.scenarioLineWidth,
      markerWidth: this.fontSize * this.scaleFactors.markerWidth,
      categoryWidth: this.fontSize * this.scaleFactors.categoryWidth,
      axisTickLength: this.fontSize * this.scaleFactors.axisTickLength,
    };
  }

  private calculateCategoryPosition() {
    this.categoryPosition = {
      x: this.padding.left,
      y: this.getAxisPositionY() + this.spacings.categoryWidth * 0.5,
    };
  }

  private calculateAxisPosition() {
    this.axisPosition = {
      x: this.getAxisPositionX(),
      y: this.getAxisPositionY(),
    };
  }

  // @ts-ignore
  private recalculatePositions() {
    this.calculateCategoryPosition();
    this.calculateAxisPosition();
  }

  private getAxisTitleOffset() {
    // Title height plus the gap to the labels that can stick out above the first bar
    return this.topSideLabelHeight + this.spacings.labelToAxis + this.getTopLabelOverhang();
  }

  private getTopLabelOverhang(): number {
    return this.hasStackedHeaders ? this.getStackedHeaderOverhang() : this.getTopScenarioLabelOverhang();
  }

  /**
   * How far the stacked-segment header row (anchored just above the first bar)
   * reaches above the axis start. The title is moved up by this amount so the
   * header row sits between title and bars without overlapping either.
   */
  private getStackedHeaderOverhang(): number {
    return Math.max(
      0,
      this.fontSize +
        this.spacings.scenarioLabelToBar +
        this.spacings.barWidth * 0.5 -
        (this.spacings.categoryWidth * 0.5 + this.spacings.scenarioOffset),
    );
  }

  /**
   * How far the scenario labels above the first bar (secondary bar label) or
   * above the first marker (primary marker label) reach above the axis start.
   * The title is moved up by this amount so it does not overlap them.
   */
  private getTopScenarioLabelOverhang(): number {
    const barLabelOverhang =
      this.fontSize +
      this.spacings.barWidth * 0.5 +
      this.spacings.scenarioLabelToBar -
      this.spacings.categoryWidth * 0.5;
    const markerLabelOverhang =
      this.fontSize +
      this.spacings.markerWidth * 0.5 +
      this.spacings.scenarioLabelToBar +
      this.spacings.markerOffset +
      this.spacings.barWidth * 0.5 -
      (this.spacings.categoryWidth * 0.5 + this.spacings.scenarioOffset);
    return Math.max(0, barLabelOverhang, markerLabelOverhang);
  }

  private calculateSideLabelLength(titleLength: number, leftSideWidth: number, categoryWidth: number) {
    if (this.leftSideLengthSync) {
      return this.leftSideLengthSync;
    }
    const leftSideTitleLength = titleLength / 2;
    let sideLabelLength = leftSideWidth;

    if (leftSideTitleLength > sideLabelLength) {
      sideLabelLength = leftSideTitleLength;
    }

    if (categoryWidth > sideLabelLength) {
      sideLabelLength = categoryWidth;
    }

    return sideLabelLength;
  }
}
