// import { IAdapter } from "../../../../../utils/helper/IAdapter";
import { CompareUtil } from "../../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../../utils/helper/IAdapter";
import { SVGPolgonPattern } from "../../../../../utils/model";
//import { SVGPolgonPattern, SVGStyleGroup, SVGVariancesStyleGroup } from "../../../../../../utils/model";
import { FontStyle, FontStyleAdapter } from "../../../../../utils/model/styles/FontStyle";
import { Padding, PaddingAdapter } from "../../../../../utils/model/styles/Padding";
import { SVGStyleGroup, SVGStyleGroupAdapter } from "../../../../../utils/model/styles/SVGStyleGroup";

import {
  SVGVariancesStyleGroup,
  SVGVariancesStyleGroupAdapter,
} from "../../../../../utils/model/styles/SVGVariancesStyleGroup";
import { MarkerPattern } from "../../helper/MarkerPattern";
// import { MarkerPattern, Padding } from "../../helper";
// import { CompareUtil } from "../../../../../utils/helper/CompareUtil";
import { ScaleFactorsStructureChart, ScaleFactorsStructureChartAdapter } from "./ScaleFactorsStructureChart";
// import { FontStyle, FontStyleAdapter } from "../../../../../utils/model/styles/FontStyle";
// import { SVGStyleGroup, SVGStyleGroupAdapter } from "../../../../../utils/model/styles/SVGStyleGroup";
// import { SVGVariancesStyleGroup, SVGVariancesStyleGroupAdapter } from "../../../../../utils/model/styles/SVGVariancesStyleGroup";
// import { SVGPolgonPattern } from "../../../../../utils/model";
// import { Padding, PaddingAdapter } from "../../../../../utils/model/styles/Padding";

/** Aggregates all style configuration for a structure chart: scale factors, fonts, colors, patterns, and padding. */
export class StructureChartStyle {
  public pattern: Map<string, SVGPolgonPattern> = new Map<string, SVGPolgonPattern>();

  constructor(
    public scaleFactors: ScaleFactorsStructureChart,
    public fontStyles: FontStyle,
    public axisStyles: SVGStyleGroup,
    public barStyles: SVGStyleGroup,
    public varianceStyles: SVGVariancesStyleGroup,
    public padding: Padding,
  ) {}
}

/** Adapts raw componentStyle JSON into a StructureChartStyle, falling back to defaults for missing properties. */
export class StructureChartStylesAdapter implements IAdapter<StructureChartStyle> {
  constructor(
    private scaleFactorsStructureChartAdapter: ScaleFactorsStructureChartAdapter,
    private fontStyleAdapter: FontStyleAdapter,
    private svgStyleGroupAdapter: SVGStyleGroupAdapter,
    private svgVariancesStyleGroupAdapter: SVGVariancesStyleGroupAdapter,
    private paddingadapter: PaddingAdapter,
  ) {}

  adapt(data: Record<string, unknown>): StructureChartStyle {
    const styles: StructureChartStyle = new StructureChartStyle(
      this.scaleFactorsStructureChartAdapter.default(),
      this.fontStyleAdapter.default(),
      this.svgStyleGroupAdapter.default(),
      this.svgStyleGroupAdapter.default(),
      this.svgVariancesStyleGroupAdapter.default(),
      this.paddingadapter.default(),
    );

    if (CompareUtil.isExisting(data)) {
      if (CompareUtil.isExisting(data.scaleFactors)) {
        styles.scaleFactors = this.scaleFactorsStructureChartAdapter.adapt(data.scaleFactors);
      }

      if (CompareUtil.isExisting(data.fontStyles)) {
        styles.fontStyles = this.fontStyleAdapter.adapt(data.fontStyles);
      }

      if (CompareUtil.isExisting(data.axisStyles)) {
        styles.axisStyles = this.svgStyleGroupAdapter.adapt(data.axisStyles);
      }

      if (CompareUtil.isExisting(data.barStyles)) {
        styles.barStyles = this.svgStyleGroupAdapter.adapt(data.barStyles);
      }

      if (CompareUtil.isExisting(data.varianceStyles)) {
        styles.varianceStyles = this.svgVariancesStyleGroupAdapter.adapt(data.varianceStyles);
      }

      if (CompareUtil.isExisting(data.padding)) {
        styles.padding = this.paddingadapter.adapt(data.padding);
      }

      styles.pattern = new MarkerPattern(styles.fontStyles.size).createPatternMapForStructureBar();
    }
    return styles;
  }

  default(): StructureChartStyle {
    return new StructureChartStyle(
      this.scaleFactorsStructureChartAdapter.default(),
      this.fontStyleAdapter.default(),
      this.svgStyleGroupAdapter.default(),
      this.svgStyleGroupAdapter.default(),
      this.svgVariancesStyleGroupAdapter.default(),
      this.paddingadapter.default(),
    );
  }
}
