import { CompareUtil } from "../../helper/CompareUtil";
import { IAdapter } from "../../helper/IAdapter";

/**
 * Proportional scale factors for XY chart elements (scatter and bubble).
 *
 * All values are expressed in **font-size multiples** (em-like units), so
 * the chart scales uniformly when the base font size changes. The chart
 * renderer multiplies each factor by the computed font size to get pixel
 * dimensions. The line widths give 1 px at the default font size.
 */
export class ScaleFactorsXYChart {
  /** Radius of a scatter point. */
  public pointRadius: number = 0.4;
  /** Maximum bubble radius in local (vMax-normalized) sizing mode. */
  public bubbleMaxRadius: number = 3.2;
  /** Minimum visible bubble radius in local sizing mode. */
  public bubbleMinRadius: number = 0.35;
  /** Length of axis tick marks. */
  public axisTickLength: number = 0.35;
  /** Gap between a mark (dot/bubble) and its name label. */
  public labelToMark: number = 0.3;
  /** Diameter of a legend color swatch. */
  public legendSwatch: number = 0.9;
  /** Gap between facet panels. */
  public panelGap: number = 1.6;
  /** Stroke width of reference lines. */
  public refLineWidth: number = 0.075;
  /** Stroke width of gridlines and the plot frame. */
  public gridLineWidth: number = 0.075;

  constructor() {}
}

/** Converts untyped JSON into a validated {@link ScaleFactorsXYChart}. */
export class ScaleFactorsXYChartAdapter implements IAdapter<ScaleFactorsXYChart> {
  adapt(data: Record<string, unknown>): ScaleFactorsXYChart {
    const scaleFactors: ScaleFactorsXYChart = new ScaleFactorsXYChart();

    if (CompareUtil.isNumber(data.pointRadius)) {
      scaleFactors.pointRadius = data.pointRadius;
    }

    if (CompareUtil.isNumber(data.bubbleMaxRadius)) {
      scaleFactors.bubbleMaxRadius = data.bubbleMaxRadius;
    }

    if (CompareUtil.isNumber(data.bubbleMinRadius)) {
      scaleFactors.bubbleMinRadius = data.bubbleMinRadius;
    }

    if (CompareUtil.isNumber(data.axisTickLength)) {
      scaleFactors.axisTickLength = data.axisTickLength;
    }

    if (CompareUtil.isNumber(data.labelToMark)) {
      scaleFactors.labelToMark = data.labelToMark;
    }

    if (CompareUtil.isNumber(data.legendSwatch)) {
      scaleFactors.legendSwatch = data.legendSwatch;
    }

    if (CompareUtil.isNumber(data.panelGap)) {
      scaleFactors.panelGap = data.panelGap;
    }

    if (CompareUtil.isNumber(data.refLineWidth)) {
      scaleFactors.refLineWidth = data.refLineWidth;
    }

    if (CompareUtil.isNumber(data.gridLineWidth)) {
      scaleFactors.gridLineWidth = data.gridLineWidth;
    }

    return scaleFactors;
  }

  default(): ScaleFactorsXYChart {
    return new ScaleFactorsXYChart();
  }
}
