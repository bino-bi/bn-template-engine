// import { IAdapter } from "../../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../../utils/helper/CompareUtil";

import { CompareUtil } from "../../../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../../../utils/helper/IAdapter";

export class ScaleFactorsTimeChart {
  public scenarioOffset: number = 0.3;
  public scenarioLabelToColumn: number = 0.3;
  public labelToColumn: number = 0.3;
  public labelToAxis: number = 0.3;
  public needleWidth: number = 0.3;
  public needleHeadWidth: number = 0.6;
  public columnWidth: number = 2.0;
  public varianceAxisLineWidth: number = 0.3;
  public axisLineWidth: number = 0.1;
  public auxiliaryLineWidth: number = 0.1;
  public scenarioLineWidth: number = 0.2;
  public markerWidth: number = 0.7;
  public markerOffset: number = 0.0;
  public categoryWidth: number = 3.0;
  public axisTickLength: number = 0.3;

  constructor() {

  }
}


export class ScaleFactorsTimeChartAdapter implements IAdapter<ScaleFactorsTimeChart> {

  adapt(data: any): ScaleFactorsTimeChart {
    const scaleFactors: ScaleFactorsTimeChart = new ScaleFactorsTimeChart();

    if (CompareUtil.isNumber(data.scenarioOffset)) {
      scaleFactors.scenarioOffset = data.scenarioOffset;
    }

    if (CompareUtil.isNumber(data.scenarioLabelToColumn)) {
      scaleFactors.scenarioLabelToColumn = data.scenarioLabelToColumn;
    }

    if (CompareUtil.isNumber(data.labelToColumn)) {
      scaleFactors.labelToColumn = data.labelToColumn;
    }

    if (CompareUtil.isNumber(data.labelToAxis)) {
      scaleFactors.labelToAxis = data.labelToAxis;
    }

    if (CompareUtil.isNumber(data.needleWidth)) {
      scaleFactors.needleWidth = data.needleWidth;
    }

    if (CompareUtil.isNumber(data.needleHeadWidth)) {
      scaleFactors.needleHeadWidth = data.needleHeadWidth;
    }

    if (CompareUtil.isNumber(data.columnWidth)) {
      scaleFactors.columnWidth = data.columnWidth;
    }

    if (CompareUtil.isNumber(data.varianceAxisLineWidth)) {
      scaleFactors.varianceAxisLineWidth = data.varianceAxisLineWidth;
    }

    if (CompareUtil.isNumber(data.axisLineWidth)) {
      scaleFactors.axisLineWidth = data.axisLineWidth;
    }

    if (CompareUtil.isNumber(data.auxiliaryLineWidth)) {
      scaleFactors.auxiliaryLineWidth = data.auxiliaryLineWidth;
    }

    if (CompareUtil.isNumber(data.scenarioLineWidth)) {
      scaleFactors.scenarioLineWidth = data.scenarioLineWidth;
    }

    if (CompareUtil.isNumber(data.markerWidth)) {
      scaleFactors.markerWidth = data.markerWidth;
    }

    if (CompareUtil.isNumber(data.markerOffset)) {
      scaleFactors.markerOffset = data.markerOffset;
    }

    if (CompareUtil.isNumber(data.categoryWidth)) {
      scaleFactors.categoryWidth = data.categoryWidth;
    }

    if (CompareUtil.isNumber(data.axisTickLength)) {
      scaleFactors.axisTickLength = data.axisTickLength;
    }

    return scaleFactors;
  }

  default(): ScaleFactorsTimeChart {
    return new ScaleFactorsTimeChart();
  }
}
