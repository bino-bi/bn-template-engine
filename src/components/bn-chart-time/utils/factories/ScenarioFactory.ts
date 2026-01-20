import {G} from "@svgdotjs/svg.js";

import {Column, Marker,} from "../elements";

import {ElementPositions,} from "../helper";

import {DataPoint} from "../model";
import {Needle} from "../elements/Needle";
// import {SVGPolgonPattern} from "../../../../utils/model";
import {TimeChartStyle} from "../model/styles/TimeChartStyle";
import { SVGPolgonPattern } from "../../../../utils/model";
import { Line } from "../elements/Line";
import { LineSeries, LineSeriesDataPoint } from "../elements/LineSeries";

export class ScenarioFactory {
  
  styles: TimeChartStyle;
  svgGroups: {
    parent: G,
    scenario1: G,
    scenario2: G,
    scenario3: G,
    scenario4: G,
    scenario1Label: G,
  }

  position: ElementPositions;

  pixelPerUnit: number = 1;
  elementCnt: number;
  private i18n: Map<string | number, string>;

  constructor(position: ElementPositions, scenariosGroupParent: G, styles: TimeChartStyle, elementCnt: number, i18n: Map<string | number, string>) {
    this.i18n = i18n;

    let primScenario: G = scenariosGroupParent.group().id("Scenario1");
    let secondScenario: G = scenariosGroupParent.group().id("Scenario2").insertBefore(primScenario);

    this.svgGroups = {
      parent:    scenariosGroupParent,
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

  public createLine(name: string, dataPoint: any, previousDataPoint: any, index: number): Line {
    let isPrimaryColumn = false;
    let columnGroup = this.svgGroups.scenario1.group().id("" + index);
    let labelGroup = this.svgGroups.scenario1Label.group().id("" + index);

    let lineLabel: string  | null = null;
    
    if (this.isLastDataPoint(index -1)){
      lineLabel =  name; ///`${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Line(this.position, this.styles, dataPoint, previousDataPoint, index, isPrimaryColumn, columnGroup, lineLabel).updateLabelGroup(labelGroup);;
  
  }

  public createPrimaryBar(dataPoint: DataPoint, index: number): Column {
    let isPrimaryColumn = true;
    let columnGroup = this.svgGroups.scenario1.group().id("" + index);
    let labelGroup = this.svgGroups.scenario1Label.group().id("" + index);

    let columnLabel: string | null = null;

    if (this.isLastDataPoint(index)) {
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Column(this.position, this.styles, dataPoint, index, isPrimaryColumn, columnGroup, columnLabel).updateLabelGroup(labelGroup);
  }

  public createVarianceBar(dataPoint: DataPoint, index: number): Column {
    let isPrimaryColumn = true;
    let columnGroup = this.svgGroups.scenario1.group().id("" + index);
    let labelGroup = this.svgGroups.scenario1Label.group().id("" + index);

    let columnLabel: string | null = null;

    if (this.isLastDataPoint(index)){
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Column(this.position, this.styles, dataPoint, index, isPrimaryColumn, columnGroup, columnLabel).updateLabelGroup(labelGroup).setAsVariance();
  }

  public createRelativeVarianceBar(dataPoint: DataPoint, index: number): Needle {
    let needleGroup = this.svgGroups.scenario1.group().id("" + index);
    let labelGroup = this.svgGroups.scenario1Label.group().id("" + index);

    return new Needle(this.position, this.styles, dataPoint, index, needleGroup).updateLabelGroup(labelGroup);
  }

  public createSecondaryBar(dataPoint: DataPoint, index: number): Column {
    let isPrimaryBar = false;
    let barGroup = this.svgGroups.scenario2.group().id("" + index);

    let columnLabel: string | null = null;

    if (this.isFirstDataPoint(index) ){
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }


    return new Column(this.position, this.styles, dataPoint, index, isPrimaryBar, barGroup, columnLabel);
  }

  public createPrimaryMarker(dataPoint: DataPoint, index: number): Marker {

    let markerGroup: G = this.svgGroups.scenario3.group().id("" + index);
    let markerPattern: SVGPolgonPattern = this.styles.pattern.get("marker-right") || { foreground: "#000000", background: "#ffffff",  bgOffset: 0};
    let isPrimaryMarker = true;


    let columnLabel: string | null = null;

    if (this.isFirstDataPoint(index) ){
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Marker(this.position, markerGroup, markerPattern, dataPoint.scenario, this.styles, dataPoint, index, columnLabel, isPrimaryMarker);

  }

  public createSecondaryMarker(dataPoint: DataPoint, index: number): Marker {

    let markerGroup: G = this.svgGroups.scenario4.group().id("" + index);
    let markerPattern: SVGPolgonPattern = this.styles.pattern.get("marker-left") || { foreground: "#000000", background: "#ffffff",  bgOffset: 0};
    let isPrimaryMarker = false;

    let columnLabel: string | null = null;

    if (this.isLastDataPoint(index) ){
      columnLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Marker(this.position, markerGroup, markerPattern, dataPoint.scenario, this.styles, dataPoint, index, columnLabel, isPrimaryMarker);

  }

  private isLastDataPoint(index: number): boolean {
    return (this.elementCnt - 1) === index;
  }

  private isFirstDataPoint(index: number): boolean {
    return 0 === index;
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
      this.i18n
    );
  }

}
