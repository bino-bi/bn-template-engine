import { IAdapter } from "../../helper/IAdapter";
import { SVGStyle, SVGStyleAdapter } from "./SVGStyle";
import { CompareUtil } from "../../helper/CompareUtil";

export class SVGVariancesStyleGroup {
  public needleHeadColour: string = "#000000";

  constructor(
    public pos: SVGStyle,
    public neg: SVGStyle,
    public neu: SVGStyle,
  ) {}

  getSVGStyle(scenario: string | undefined): SVGStyle {
    if (scenario === "pos") {
      return this.pos;
    }

    if (scenario === "neg") {
      return this.neg;
    }

    if (scenario === "neu") {
      return this.neu;
    }

    return this.neu;
  }
}

export class SVGVariancesStyleGroupAdapter implements IAdapter<SVGVariancesStyleGroup> {
  constructor(private svgStyleAdapter: SVGStyleAdapter) {}

  adapt(data: Record<string, unknown>): SVGVariancesStyleGroup {
    const styleGroup: SVGVariancesStyleGroup = new SVGVariancesStyleGroup(
      this.svgStyleAdapter.defaultPos(),
      this.svgStyleAdapter.defaultNeg(),
      this.svgStyleAdapter.defaultNeu(),
    );

    if (CompareUtil.isExisting(data.pos)) {
      styleGroup.pos = this.svgStyleAdapter.adapt(data.pos as Record<string, unknown>);
    }

    if (CompareUtil.isExisting(data.neg)) {
      styleGroup.neg = this.svgStyleAdapter.adapt(data.neg as Record<string, unknown>);
    }

    if (CompareUtil.isExisting(data.neu)) {
      styleGroup.neu = this.svgStyleAdapter.adapt(data.neu as Record<string, unknown>);
    }

    if (CompareUtil.isString(data.needleHeadColour)) {
      styleGroup.needleHeadColour = data.needleHeadColour;
    }

    return styleGroup;
  }

  default(): SVGVariancesStyleGroup {
    return new SVGVariancesStyleGroup(
      this.svgStyleAdapter.defaultPos(),
      this.svgStyleAdapter.defaultNeg(),
      this.svgStyleAdapter.defaultNeu(),
    );
  }
}
