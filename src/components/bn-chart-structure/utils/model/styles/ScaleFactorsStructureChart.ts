// import { IAdapter } from "../../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../../utils/helper/CompareUtil";

import { CompareUtil } from "../../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../../utils/helper/IAdapter";

export class ScaleFactorsStructureChart {
  public scenarioOffset: number = 0.3;
  public scenarioLabelToBar: number = 0.1;
  public labelToBar: number = 0.3;
  public labelToAxis: number = 0.3;
  public needleWidth: number = 0.3;
  public needleHeadWidth: number = 0.6;
  public barWidth: number = 1.2;
  public varianceAxisLineWidth: number = 0.3;
  public axisLineWidth: number = 0.1;
  public auxiliaryLineWidth: number = 0.1;
  public scenarioLineWidth: number = 0.2;
  public markerWidth: number = 0.7;
  public markerOffset: number = 0.0;
  public categoryWidth: number = 1.9;
  public axisTickLength: number = 0.3;

  constructor() {}
}

export class ScaleFactorsStructureChartAdapter implements IAdapter<ScaleFactorsStructureChart> {
  adapt(data: any): ScaleFactorsStructureChart {
    const scaleFactors: ScaleFactorsStructureChart = new ScaleFactorsStructureChart();

    if (CompareUtil.isNumber(data.scenarioOffset)) {
      scaleFactors.scenarioOffset = data.scenarioOffset;
    }

    if (CompareUtil.isNumber(data.scenarioLabelToBar)) {
      scaleFactors.scenarioLabelToBar = data.scenarioLabelToBar;
    }

    if (CompareUtil.isNumber(data.labelToBar)) {
      scaleFactors.labelToBar = data.labelToBar;
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

    if (CompareUtil.isNumber(data.barWidth)) {
      scaleFactors.barWidth = data.barWidth;
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

  default(): ScaleFactorsStructureChart {
    return new ScaleFactorsStructureChart();
  }
}
