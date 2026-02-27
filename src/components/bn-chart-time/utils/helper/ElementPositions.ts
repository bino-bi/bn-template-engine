import { Box, DataPoint, Point2D } from "../model";

import { Padding } from "./Padding";

import { G } from "@svgdotjs/svg.js";
import { ScaleFactorsTimeChart } from "../model/styles/ScaleFactorsTimeChart";
import CalculateSize from "calculate-size";
import { FontStyle } from "../../../../utils/model/styles/FontStyle";
// import {FontStyle} from "../../../../utils/model/styles/FontStyle";

export class ElementPositions {
  categoryPosition: Point2D = { x: 0, y: 0 };
  axisPosition: Point2D;

  padding: Padding;
  scaleFactors: ScaleFactorsTimeChart;
  spacings: ScaleFactorsTimeChart = new ScaleFactorsTimeChart();
  categoriesBoxOffset: Box = {
    width: 0,
    height: 0,
  };

  fontStlye: FontStyle;

  columnValue: { min: DataPoint; max: DataPoint };
  numberOfColumns: number;
  leftSideLabelLength: number;
  dataLabelHeight: number;

  constructor(
    padding: Padding,
    scaleFactors: ScaleFactorsTimeChart,
    fontstyle: FontStyle,
    smallestDataPoint: DataPoint,
    highestDataPoint: DataPoint,
    numberOfColumns: number,
    leftSideLabelLength: number,
  ) {
    this.padding = padding;
    this.scaleFactors = scaleFactors;
    this.fontStlye = fontstyle;

    this.dataLabelHeight = this.caluculateDataLabelHeight();

    this.axisPosition = { x: 0, y: 0 };
    this.columnValue = {
      min: smallestDataPoint,
      max: highestDataPoint,
    };

    this.numberOfColumns = numberOfColumns;
    this.leftSideLabelLength = leftSideLabelLength;
    this.calculateSpacings();
    this.calculateCategoryPosition();
    this.calculateAxisPosition();
  }

  private caluculateDataLabelHeight(): number {
    const testlable = "123456789";
    const height = CalculateSize(testlable, {
      font: this.fontStlye.font,
      fontSize: this.fontStlye.size + "px",
    }).height;
    return height * 1.1;
  }

  public getColumnCenterPositionX(index: number): number {
    return (
      this.categoryPosition.y +
      this.spacings.scenarioOffset +
      index * this.spacings.categoryWidth +
      this.leftSideLabelLength +
      this.spacings.columnWidth * 0.5
    );
  }

  public getAxisPositionY(isRelative: boolean): number {
    let value = this.columnValue.max.getScaledUnit();

    if (isRelative) {
      value = this.columnValue.max.getScaledPercentUnit() + this.getNeedleWidth();
    }

    return value + this.dataLabelHeight + this.spacings.labelToAxis + this.padding.top;
  }

  public getAxisPositionX(): number {
    return this.padding.left + this.leftSideLabelLength;
  }

  public getColumnPositionX(index: number, isPrimaryColumn: boolean): number {
    if (isPrimaryColumn) {
      return this.getColumnCenterPositionX(index);
    }

    return this.getColumnCenterPositionX(index) - this.spacings.scenarioOffset;
  }

  public getColumnPositionY(): number {
    return this.columnValue.max.getScaledUnit() + this.dataLabelHeight + this.spacings.labelToColumn + this.padding.top;
  }

  public getNeedlePositionY(): number {
    return (
      this.columnValue.max.getScaledPercentUnit() +
      this.dataLabelHeight +
      this.spacings.labelToColumn +
      this.getNeedleWidth() +
      this.padding.top
    );
  }

  public getMarkerPositionX(index: number, isPrimaryMarker: boolean): number {
    if (isPrimaryMarker) {
      return this.getColumnCenterPositionX(index) - this.spacings.markerOffset - this.getColumnWidth() * 0.5;
    }

    return this.getColumnCenterPositionX(index) + this.spacings.markerOffset + this.getColumnWidth() * 0.5;
  }

  public getMarkerPositionY(): number {
    return this.getColumnPositionY();
  }

  public getAxisTitlePositionX(group: G): number {
    const offsetToCenterText: number = group.width() as number;
    return this.axisPosition.x - offsetToCenterText;
  }

  public getAxisTitlePositionY(isPositive: boolean, isRelative: boolean): number {
    let value = this.columnValue.max.getScaledUnit();
    if (isRelative) {
      value = this.columnValue.max.getScaledPercentUnit();
    }

    if (isPositive) {
      return value + this.dataLabelHeight + this.spacings.labelToAxis;
    } else {
      return value;
    }
  }

  public getColumnDataLabelPositionY(scaledUnit: number): number {
    const offset = this.spacings.labelToColumn;
    if (scaledUnit < 0) {
      return this.getColumnPositionY() + Math.abs(scaledUnit) + offset;
    }

    return this.getColumnPositionY() - scaledUnit - offset;
  }

  public getNeedleDataLabelPositionY(scaledUnit: number): number {
    const offset = this.spacings.labelToColumn;
    if (scaledUnit < 0) {
      return this.getNeedlePositionY() + Math.abs(scaledUnit) + offset + 2 * this.getNeedleWidth();
    }

    return this.getNeedlePositionY() - scaledUnit - offset - 2 * this.getNeedleWidth();
  }

  getAxisEndPositionX() {
    return this.getAxisPositionX() + (this.numberOfColumns + 1 / 2) * this.spacings.categoryWidth;
  }

  getColumnWidth() {
    return this.spacings.columnWidth;
  }

  getNeedleWidth() {
    return this.spacings.needleWidth;
  }

  getNeedleHeadWidth() {
    return this.spacings.needleHeadWidth;
  }

  public getScenarioLabelPositionOffsetX(isPrimaryColumn: boolean): number {
    if (isPrimaryColumn) {
      return this.getColumnWidth() * 0.5 + this.spacings.scenarioLabelToColumn;
    }

    return -(this.getColumnWidth() * 0.5 + this.spacings.scenarioLabelToColumn);
  }

  private calculateSpacings() {
    this.spacings = {
      scenarioOffset: this.fontStlye.size * this.scaleFactors.scenarioOffset,
      scenarioLabelToColumn: this.fontStlye.size * this.scaleFactors.scenarioLabelToColumn,
      markerOffset: this.fontStlye.size * this.scaleFactors.markerOffset,
      labelToColumn: this.fontStlye.size * this.scaleFactors.labelToColumn,
      labelToAxis: this.fontStlye.size * this.scaleFactors.labelToAxis,
      needleWidth: this.fontStlye.size * this.scaleFactors.needleWidth,
      needleHeadWidth: this.fontStlye.size * this.scaleFactors.needleHeadWidth,
      columnWidth: this.fontStlye.size * this.scaleFactors.columnWidth,
      varianceAxisLineWidth: this.fontStlye.size * this.scaleFactors.varianceAxisLineWidth,
      axisLineWidth: this.fontStlye.size * this.scaleFactors.axisLineWidth,
      auxiliaryLineWidth: this.fontStlye.size * this.scaleFactors.auxiliaryLineWidth,
      scenarioLineWidth: this.fontStlye.size * this.scaleFactors.scenarioLineWidth,
      markerWidth: this.fontStlye.size * this.scaleFactors.markerWidth,
      categoryWidth: this.fontStlye.size * this.scaleFactors.categoryWidth,
      axisTickLength: this.fontStlye.size * this.scaleFactors.axisTickLength,
    };
  }

  private calculateCategoryPosition() {
    this.categoryPosition = {
      x: this.padding.left + this.spacings.columnWidth * 0.5,
      y: this.padding.top,
    };
  }

  private calculateAxisPosition() {
    this.axisPosition = {
      x: this.getAxisPositionX(),
      y: this.getAxisPositionY(false),
    };
  }

  getMarkerScenarioLabelPositionOffsetX(isPrimaryColumn: boolean) {
    if (isPrimaryColumn) {
      return this.spacings.labelToColumn - this.fontStlye.size;
    }

    return this.spacings.labelToColumn + this.spacings.markerWidth * 0.5;
  }
}
