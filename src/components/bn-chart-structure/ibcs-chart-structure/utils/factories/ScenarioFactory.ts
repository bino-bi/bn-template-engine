import {G} from "@svgdotjs/svg.js";

import {
Bar, Marker,
} from "../elements";

import {
  ElementPositions,
} from "../helper";

import {
  StructureChartStyle,
  DataPoint,
} from "../model";
import {Needle} from "../elements";
import { SVGPolgonPattern } from "../../../../../utils/model";
// import { SVGPolgonPattern} from "../../../../utils/model";


export class ScenarioFactory {
  styles: StructureChartStyle;
  svgGroups: {
    parent: G,
    scenario1: G,
    scenario2: G,
    scenario3: G,
    scenario4: G,
    scenario1Label: G,
  }

  position: ElementPositions;
  elementCnt: number;
  private i18n: Map<string | number, string>;

  constructor(position: ElementPositions, scenariosGroupParent: G, styles: StructureChartStyle, elementCnt: number, i18n: Map<string | number, string>){

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

  private isLastDataPoint(index: number): boolean {
    return  (this.elementCnt - 1) === index;
  }

  private isFirsttDataPoint(index: number): boolean {
    return  0 === index;
  }

  public createPrimaryBar(dataPoint: DataPoint, index: number): Bar {
    let isPrimaryBar = true;
    let barGroup = this.svgGroups?.scenario1?.group().id("" + index);
    let labelGroup  = this.svgGroups?.scenario1Label?.group().id("" + index);

    let barLabel: string | null = null;

    if (this.isLastDataPoint(index)) {
      barLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Bar(this.position, this.styles, dataPoint, index, isPrimaryBar,  barGroup, barLabel).updateLabelGroup(labelGroup);
  }

  public createVarianceBar(dataPoint: DataPoint, index: number): Bar {
    let isPrimaryBar = true;
    let barGroup = this.svgGroups?.scenario1?.group().id("" + index);
    let labelGroup  = this.svgGroups?.scenario1Label?.group().id("" + index);

    let barLabel: string | null = null;

    if (this.isLastDataPoint(index)){
      barLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Bar(this.position, this.styles, dataPoint, index, isPrimaryBar, barGroup, barLabel).updateLabelGroup(labelGroup).setAsVariance();
  }

  public createRelativeVarianceBar(dataPoint: DataPoint, index: number): Needle {
    let barGroup = this.svgGroups?.scenario1?.group().id("" + index);
    let labelGroup  = this.svgGroups?.scenario1Label?.group().id("" + index);

    return new Needle(this.position, this.styles, dataPoint, index,  barGroup).updateLabelGroup(labelGroup);
  }

  public createSecondaryBar(dataPoint: DataPoint, index: number): Bar {
    let isPrimaryBar = true;
    let barGroup = this.svgGroups?.scenario2?.group().id("" + index);
    let barLabel: string | null = null;

    if(this.isFirsttDataPoint(index)) {
      barLabel = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Bar(this.position, this.styles, dataPoint, index, !isPrimaryBar, barGroup, barLabel);
  }

  public createPrimaryMarker(dataPoint: DataPoint,  index: number): Marker {
    let markerGroup: G = this.svgGroups?.scenario3?.group().id("" + index);
    let markerPattern: SVGPolgonPattern = this.styles.pattern.get("marker-down") || { foreground: "0,0 1,0 1,1 0,1", background: "0,0 1,0 1,1 0,1",  bgOffset: 0};
    let isPrimaryMarker = true;

    let labelText: string | null = null;


    if (this.isFirstDataPoint(index)){
      labelText = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }

    return new Marker(this.position, markerGroup, markerPattern, dataPoint.scenario as string, this.styles, dataPoint, index, labelText, isPrimaryMarker);

  }

  public createSecondaryMarker(dataPoint: DataPoint,  index: number): Marker {
    let markerGroup: G = this.svgGroups?.scenario4?.group().id("" + index);
    let markerPattern: SVGPolgonPattern = this.styles.pattern.get("marker-up") || { foreground: "0,0 1,0 1,1 0,1", background: "0,0 1,0 1,1 0,1",  bgOffset: 0};
    let isPrimaryMarker = false;

    let labelText: string | null = null;

    if (this.isLastDataPoint(index)){
      labelText = `${this.i18n.get(dataPoint.scenario as string) || dataPoint.scenario}`;
    }


    return new Marker(this.position, markerGroup, markerPattern, dataPoint.scenario as string, this.styles, dataPoint, index, labelText, isPrimaryMarker);

  }

  private isFirstDataPoint(index: number): boolean {
    return  0 === index;
  }

}
