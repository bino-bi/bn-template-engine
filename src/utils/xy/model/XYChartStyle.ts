import { CompareUtil } from "../../helper/CompareUtil";
import { IAdapter } from "../../helper/IAdapter";
import { FontStyle, FontStyleAdapter } from "../../model/styles/FontStyle";
import { Padding, PaddingAdapter } from "../../model/styles/Padding";
import { SVGStyleGroup, SVGStyleGroupAdapter } from "../../model/styles/SVGStyleGroup";
import { XY_SERIES_PALETTE } from "../SeriesPalette";
import { ScaleFactorsXYChart, ScaleFactorsXYChartAdapter } from "./ScaleFactorsXYChart";

/** `stroke` is the outline of a filled dot or bubble, `opacity` (0 to 1) applies to its fill. */
export interface XYMarkStyle {
  stroke: string;
  opacity: number;
}

/**
 * Aggregates all style configuration for an XY chart (scatter/bubble):
 * scale factors, fonts, axis styles, the series color palette, and padding.
 *
 * The analog of {@link TimeChartStyle} with `seriesColors` in place of
 * `stackColors` and no variance styles (variance measures position points,
 * they don't color them).
 */
export class XYChartStyle {
  public seriesColors: string[] = [...XY_SERIES_PALETTE];
  /** Look of a filled mark: the line around it and how solid its fill is. */
  public markStyles: XYMarkStyle = { stroke: "#ffffff", opacity: 1 };
  /** Locale for number labels. */
  public locale: string = "de";

  constructor(
    public scaleFactors: ScaleFactorsXYChart,
    public fontStyles: FontStyle,
    public axisStyles: SVGStyleGroup,
    public padding: Padding,
  ) {}
}

/** Adapts raw componentStyle JSON into an XYChartStyle, falling back to defaults for missing properties. */
export class XYChartStylesAdapter implements IAdapter<XYChartStyle> {
  constructor(
    private scaleFactorsXYChartAdapter: ScaleFactorsXYChartAdapter,
    private fontStyleAdapter: FontStyleAdapter,
    private svgStyleGroupAdapter: SVGStyleGroupAdapter,
    private paddingAdapter: PaddingAdapter,
  ) {}

  adapt(data: Record<string, unknown>): XYChartStyle {
    const styles: XYChartStyle = this.default();

    if (CompareUtil.isExisting(data)) {
      if (CompareUtil.isExisting(data.scaleFactors)) {
        styles.scaleFactors = this.scaleFactorsXYChartAdapter.adapt(data.scaleFactors as Record<string, unknown>);
      }

      if (CompareUtil.isExisting(data.fontStyles)) {
        styles.fontStyles = this.fontStyleAdapter.adapt(data.fontStyles as Record<string, unknown>);
      }

      if (CompareUtil.isExisting(data.axisStyles)) {
        styles.axisStyles = this.svgStyleGroupAdapter.adapt(data.axisStyles as Record<string, unknown>);
      }

      if (CompareUtil.isExisting(data.padding)) {
        styles.padding = this.paddingAdapter.adapt(data.padding as Record<string, unknown>);
      }

      if (CompareUtil.isObject(data.markStyles)) {
        const { stroke, opacity } = data.markStyles as Record<string, unknown>;
        if (CompareUtil.isString(stroke) && stroke !== "") {
          styles.markStyles.stroke = stroke;
        }
        if (CompareUtil.isNumber(opacity) && opacity >= 0 && opacity <= 1) {
          styles.markStyles.opacity = opacity;
        }
      }

      if (Array.isArray(data.seriesColors) && data.seriesColors.length > 0) {
        styles.seriesColors = data.seriesColors as string[];
      }
    }

    return styles;
  }

  default(): XYChartStyle {
    return new XYChartStyle(
      this.scaleFactorsXYChartAdapter.default(),
      this.fontStyleAdapter.default(),
      this.svgStyleGroupAdapter.default(),
      this.paddingAdapter.default(),
    );
  }
}
