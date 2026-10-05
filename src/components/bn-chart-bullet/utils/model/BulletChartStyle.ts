import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";
import { FontStyle, FontStyleAdapter } from "../../../../utils/model/styles/FontStyle";
import { Padding, PaddingAdapter } from "../../../../utils/model/styles/Padding";
import { SVGStyleGroup, SVGStyleGroupAdapter } from "../../../../utils/model/styles/SVGStyleGroup";
import {
  SVGVariancesStyleGroup,
  SVGVariancesStyleGroupAdapter,
} from "../../../../utils/model/styles/SVGVariancesStyleGroup";

/**
 * Proportional scale factors for bullet graph elements.
 *
 * All values except the `*LineWidth` entries are expressed in **font-size
 * multiples** (em-like units), so the chart scales uniformly when the base
 * font size changes. Line widths are absolute pixel values (hairlines must
 * not scale with the font).
 */
export class ScaleFactorsBulletChart {
  /** Height of one KPI row. */
  public rowHeight: number = 1.9;
  /** Height of the actual-value bar. */
  public barHeight: number = 0.66;
  /** Height of the integrated variance bar overlay. */
  public varianceHeight: number = 0.4;
  /** Height of a per-row target tick (classic mode). */
  public targetTickHeight: number = 1.1;
  /** Stroke width of the shared target line, in pixels. */
  public targetLineWidth: number = 2;
  /** Stroke width of the baseline axis, in pixels. */
  public axisLineWidth: number = 1;
  /** Gap between a bar end and its value label. */
  public labelToBar: number = 0.3;
  /** Gap between the category label column and the baseline axis. */
  public labelToAxis: number = 0.3;
  /** Length of axis tick marks (classic mode). */
  public axisTickLength: number = 0.35;
  /** Height of the per-row tick-label strip (classic mode). */
  public tickStripHeight: number = 1.2;

  constructor() {}
}

/** Converts untyped JSON into a validated {@link ScaleFactorsBulletChart}. */
export class ScaleFactorsBulletChartAdapter implements IAdapter<ScaleFactorsBulletChart> {
  adapt(data: Record<string, unknown>): ScaleFactorsBulletChart {
    const scaleFactors: ScaleFactorsBulletChart = new ScaleFactorsBulletChart();

    if (CompareUtil.isNumber(data.rowHeight)) {
      scaleFactors.rowHeight = data.rowHeight;
    }

    if (CompareUtil.isNumber(data.barHeight)) {
      scaleFactors.barHeight = data.barHeight;
    }

    if (CompareUtil.isNumber(data.varianceHeight)) {
      scaleFactors.varianceHeight = data.varianceHeight;
    }

    if (CompareUtil.isNumber(data.targetTickHeight)) {
      scaleFactors.targetTickHeight = data.targetTickHeight;
    }

    if (CompareUtil.isNumber(data.targetLineWidth)) {
      scaleFactors.targetLineWidth = data.targetLineWidth;
    }

    if (CompareUtil.isNumber(data.axisLineWidth)) {
      scaleFactors.axisLineWidth = data.axisLineWidth;
    }

    if (CompareUtil.isNumber(data.labelToBar)) {
      scaleFactors.labelToBar = data.labelToBar;
    }

    if (CompareUtil.isNumber(data.labelToAxis)) {
      scaleFactors.labelToAxis = data.labelToAxis;
    }

    if (CompareUtil.isNumber(data.axisTickLength)) {
      scaleFactors.axisTickLength = data.axisTickLength;
    }

    if (CompareUtil.isNumber(data.tickStripHeight)) {
      scaleFactors.tickStripHeight = data.tickStripHeight;
    }

    return scaleFactors;
  }

  default(): ScaleFactorsBulletChart {
    return new ScaleFactorsBulletChart();
  }
}

/**
 * Aggregates all style configuration for a bullet graph: scale factors,
 * fonts, scenario colors, variance colors, range-band grays, and padding.
 *
 * The analog of {@link StructureChartStyle} with `rangeColors` (the max two
 * qualitative band grays) in place of `stackColors` and no fill patterns
 * (the FC target treatment uses a dashed stroke, not hatching).
 */
export class BulletChartStyle {
  public rangeColors: string[] = ["#D9D9D9", "#EFEFEF"];
  /** Locale for number labels. */
  public locale: string = "de";

  constructor(
    public scaleFactors: ScaleFactorsBulletChart,
    public fontStyles: FontStyle,
    public axisStyles: SVGStyleGroup,
    public barStyles: SVGStyleGroup,
    public varianceStyles: SVGVariancesStyleGroup,
    public padding: Padding,
  ) {}
}

/** Adapts raw componentStyle JSON into a BulletChartStyle, falling back to defaults for missing properties. */
export class BulletChartStylesAdapter implements IAdapter<BulletChartStyle> {
  constructor(
    private scaleFactorsBulletChartAdapter: ScaleFactorsBulletChartAdapter,
    private fontStyleAdapter: FontStyleAdapter,
    private svgStyleGroupAdapter: SVGStyleGroupAdapter,
    private svgVariancesStyleGroupAdapter: SVGVariancesStyleGroupAdapter,
    private paddingAdapter: PaddingAdapter,
  ) {}

  adapt(data: Record<string, unknown>): BulletChartStyle {
    const styles: BulletChartStyle = this.default();

    if (CompareUtil.isExisting(data)) {
      if (CompareUtil.isExisting(data.scaleFactors)) {
        styles.scaleFactors = this.scaleFactorsBulletChartAdapter.adapt(data.scaleFactors as Record<string, unknown>);
      }

      if (CompareUtil.isExisting(data.fontStyles)) {
        styles.fontStyles = this.fontStyleAdapter.adapt(data.fontStyles as Record<string, unknown>);
      }

      if (CompareUtil.isExisting(data.axisStyles)) {
        styles.axisStyles = this.svgStyleGroupAdapter.adapt(data.axisStyles as Record<string, unknown>);
      }

      if (CompareUtil.isExisting(data.barStyles)) {
        styles.barStyles = this.svgStyleGroupAdapter.adapt(data.barStyles as Record<string, unknown>);
      }

      if (CompareUtil.isExisting(data.varianceStyles)) {
        styles.varianceStyles = this.svgVariancesStyleGroupAdapter.adapt(
          data.varianceStyles as Record<string, unknown>,
        );
      }

      if (CompareUtil.isExisting(data.padding)) {
        styles.padding = this.paddingAdapter.adapt(data.padding as Record<string, unknown>);
      }

      if (Array.isArray(data.rangeColors) && data.rangeColors.length > 0) {
        styles.rangeColors = data.rangeColors as string[];
      }
    }

    return styles;
  }

  default(): BulletChartStyle {
    return new BulletChartStyle(
      this.scaleFactorsBulletChartAdapter.default(),
      this.fontStyleAdapter.default(),
      this.svgStyleGroupAdapter.default(),
      this.svgStyleGroupAdapter.default(),
      this.svgVariancesStyleGroupAdapter.default(),
      this.paddingAdapter.default(),
    );
  }
}
