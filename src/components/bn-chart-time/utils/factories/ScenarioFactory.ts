import { G } from "@svgdotjs/svg.js";

import { Column, Marker } from "../elements";

import { ElementPositions, LabelCollisionManager } from "../helper";

import { DataPoint } from "../model";
import { Needle } from "../elements/Needle";
// import {SVGPolgonPattern} from "../../../../utils/model";
import { TimeChartStyle } from "../model/styles/TimeChartStyle";
import { SVGPolgonPattern } from "../../../../utils/model";
import { Line } from "../elements/Line";
import { LineSeries, LineSeriesDataPoint } from "../elements/LineSeries";
import { OverflowConfig } from "../model/OverflowConfig";

export class ScenarioFactory {
  styles: TimeChartStyle;
  svgGroups: {
    parent: G;
    scenario1: G;
    scenario2: G;
    scenario3: G;
    scenario4: G;
    scenario1Label: G;
  };

  position: ElementPositions;

  pixelPerUnit: number = 1;
  elementCnt: number;
  private i18n: Map<string | number, string>;
  private collisionManager: LabelCollisionManager | null = null;
  private overflowConfig: OverflowConfig | null = null;

  constructor(
    position: ElementPositions,
    scenariosGroupParent: G,
    styles: TimeChartStyle,
    elementCnt: number,
    i18n: Map<string | number, string>,
  ) {
    this.i18n = i18n;

    const primScenario: G = scenariosGroupParent.group().id("Scenario1");
    const secondScenario: G = scenariosGroupParent.group().id("Scenario2").insertBefore(primScenario);

    this.svgGroups = {
      parent: scenariosGroupParent,
      scenario1: primScenario,
      scenario2: secondScenario,
      scenario3: scenariosGroupParent.group().id("Scenario3"),
      scenario4: scenariosGroupParent.group().id("Scenario4"),
      scenario1Label: scenariosGroupParent.group().id("label"),
    };

    this.styles = styles;

    this.position = position;
    this.elementCnt = elementCnt;
  }

  public setOverflowConfig(config: OverflowConfig | null): void {
    this.overflowConfig = config;
  }

  public createLine(name: string, dataPoint: DataPoint, previousDataPoint: DataPoint, index: number): Line {
    const isPrimaryColumn = false;
    const columnGroup = this.svgGroups.scenario1.group().id("" + index);
    const labelGroup = this.svgGroups.scenario1Label.group().id("" + index);

    let lineLabel: string | null = null;

    if (this.isLastDataPoint(index - 1)) {
      lineLabel = name; ///`${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Line(
      this.position,
      this.styles,
      dataPoint,
      previousDataPoint,
      index,
      isPrimaryColumn,
      columnGroup,
      lineLabel,
    ).updateLabelGroup(labelGroup);
  }

  public createPrimaryBar(dataPoint: DataPoint, index: number): Column {
    const isPrimaryColumn = true;
    const columnGroup = this.svgGroups.scenario1.group().id("" + index);
    const labelGroup = this.svgGroups.scenario1Label.group().id("" + index);

    let columnLabel: string | null = null;

    if (this.isLastDataPoint(index)) {
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Column(
      this.position,
      this.styles,
      dataPoint,
      index,
      isPrimaryColumn,
      columnGroup,
      columnLabel,
      this.overflowConfig,
    ).updateLabelGroup(labelGroup);
  }

  public createVarianceBar(dataPoint: DataPoint, index: number): Column {
    const isPrimaryColumn = true;
    const columnGroup = this.svgGroups.scenario1.group().id("" + index);
    const labelGroup = this.svgGroups.scenario1Label.group().id("" + index);

    let columnLabel: string | null = null;

    if (this.isLastDataPoint(index)) {
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Column(
      this.position,
      this.styles,
      dataPoint,
      index,
      isPrimaryColumn,
      columnGroup,
      columnLabel,
      this.overflowConfig,
    )
      .updateLabelGroup(labelGroup)
      .setAsVariance();
  }

  public createRelativeVarianceBar(dataPoint: DataPoint, index: number): Needle {
    const needleGroup = this.svgGroups.scenario1.group().id("" + index);
    const labelGroup = this.svgGroups.scenario1Label.group().id("" + index);

    return new Needle(this.position, this.styles, dataPoint, index, needleGroup).updateLabelGroup(labelGroup);
  }

  public createSecondaryBar(dataPoint: DataPoint, index: number): Column {
    const isPrimaryBar = false;
    const barGroup = this.svgGroups.scenario2.group().id("" + index);

    let columnLabel: string | null = null;

    if (this.isFirstDataPoint(index)) {
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Column(
      this.position,
      this.styles,
      dataPoint,
      index,
      isPrimaryBar,
      barGroup,
      columnLabel,
      this.overflowConfig,
    );
  }

  public createPrimaryMarker(dataPoint: DataPoint, index: number): Marker {
    const markerGroup: G = this.svgGroups.scenario3.group().id("" + index);
    const markerPattern: SVGPolgonPattern = this.styles.pattern.get("marker-right") || {
      foreground: "#000000",
      background: "#ffffff",
      bgOffset: 0,
    };
    const isPrimaryMarker = true;

    let columnLabel: string | null = null;

    if (this.isFirstDataPoint(index)) {
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Marker(
      this.position,
      markerGroup,
      markerPattern,
      dataPoint.scenario,
      this.styles,
      dataPoint,
      index,
      columnLabel,
      isPrimaryMarker,
    );
  }

  public createSecondaryMarker(dataPoint: DataPoint, index: number): Marker {
    const markerGroup: G = this.svgGroups.scenario4.group().id("" + index);
    const markerPattern: SVGPolgonPattern = this.styles.pattern.get("marker-left") || {
      foreground: "#000000",
      background: "#ffffff",
      bgOffset: 0,
    };
    const isPrimaryMarker = false;

    let columnLabel: string | null = null;

    if (this.isLastDataPoint(index)) {
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Marker(
      this.position,
      markerGroup,
      markerPattern,
      dataPoint.scenario,
      this.styles,
      dataPoint,
      index,
      columnLabel,
      isPrimaryMarker,
    );
  }

  private isLastDataPoint(index: number): boolean {
    return this.elementCnt - 1 === index;
  }

  private isFirstDataPoint(index: number): boolean {
    return 0 === index;
  }

  /**
   * Sets the collision manager for line series label collision detection.
   * Should be called before creating line series to enable collision detection across all series.
   */
  public setCollisionManager(manager: LabelCollisionManager): void {
    this.collisionManager = manager;
  }

  /**
   * Moves the label group to the front of the SVG tree so labels render on top of all geometry.
   */
  public moveLabelsToFront(): void {
    this.svgGroups.scenario1Label.front();
  }

  public createLineSeries(dataPoints: LineSeriesDataPoint[], scenarioName: string): LineSeries {
    const lineSeriesGroup = this.svgGroups.parent.group().id("LineSeries_" + scenarioName);
    const labelGroup = this.svgGroups.scenario1Label.group().id("LineSeries_Label_" + scenarioName);

    // Scenario label for the line (to be shown at the right of the last data point)
    const scenarioLabel = `${this.i18n.get(scenarioName) || scenarioName}`;

    return new LineSeries(
      this.position,
      this.styles,
      dataPoints,
      lineSeriesGroup,
      labelGroup,
      scenarioName,
      scenarioLabel,
      this.i18n,
      this.collisionManager,
    );
  }
}
