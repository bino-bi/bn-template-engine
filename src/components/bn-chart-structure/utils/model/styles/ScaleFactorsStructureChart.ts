// import { IAdapter } from "../../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../../utils/helper/CompareUtil";

import { CompareUtil } from "../../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../../utils/helper/IAdapter";

/**
 * Proportional scale factors for structural (categorical) bar chart elements.
 *
 * All values are expressed in **font-size multiples** (em-like units), so the chart
 * scales uniformly when the base font size changes. The chart renderer multiplies
 * each factor by the computed font size to get pixel dimensions.
 */
export class ScaleFactorsStructureChart {
  /** Horizontal gap between adjacent scenario bars within a category. */
  public scenarioOffset: number = 0.3;
  /** Gap between the scenario label and the end of its bar. */
  public scenarioLabelToBar: number = 0.1;
  /** Gap between the value label and the end of its bar. */
  public labelToBar: number = 0.3;
  /** Gap between axis labels and the axis line. */
  public labelToAxis: number = 0.3;
  /** Width of the variance needle (pin chart element). */
  public needleWidth: number = 0.3;
  /** Width of the arrowhead on variance needles. */
  public needleHeadWidth: number = 0.6;
  /** Height of a single data bar. */
  public barWidth: number = 1.2;
  /** Stroke width of the variance chart axis line. */
  public varianceAxisLineWidth: number = 0.3;
  /** Stroke width of the main value axis line. */
  public axisLineWidth: number = 0.1;
  /** Stroke width of auxiliary/grid lines. */
  public auxiliaryLineWidth: number = 0.1;
  /** Stroke width of scenario indicator lines (e.g. forecast hatching). */
  public scenarioLineWidth: number = 0.2;
  /** Size of plan/previous-period marker symbols. */
  public markerWidth: number = 0.7;
  /** Vertical offset of markers from the bar center. */
  public markerOffset: number = 0.0;
  /** Total vertical space allocated per category (bar + padding). */
  public categoryWidth: number = 1.9;
  /** Length of axis tick marks. */
  public axisTickLength: number = 0.3;

  constructor() {}
}

/** Converts untyped JSON into a validated {@link ScaleFactorsStructureChart}. */
export class ScaleFactorsStructureChartAdapter implements IAdapter<ScaleFactorsStructureChart> {
  adapt(data: Record<string, unknown>): ScaleFactorsStructureChart {
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
