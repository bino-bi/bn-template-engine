import { IAdapter } from "../../helper/IAdapter";
import { SVGStyle, SVGStyleAdapter } from "./SVGStyle";
import { CompareUtil } from "../../helper/CompareUtil";


export class SVGVariancesStyleGroup {

  public needleHeadColour: string = "#000000";

  constructor(public pos: SVGStyle,
    public neg: SVGStyle,
    public neu: SVGStyle,
  ) { }


  getSVGStyle(scenario: string | undefined): SVGStyle {
    if (scenario === 'pos') {
      return this.pos;
    }

    if (scenario === 'neg') {
      return this.neg;
    }

    if (scenario === 'neu') {
      return this.neu;
    }

    return this.neu;
  }



}

export class SVGVariancesStyleGroupAdapter implements IAdapter<SVGVariancesStyleGroup> {


  constructor(private svgStyleAdapter: SVGStyleAdapter) {
  }

  adapt(data: any): SVGVariancesStyleGroup {
    const styleGroup: SVGVariancesStyleGroup = new SVGVariancesStyleGroup(this.svgStyleAdapter.defaultPos(),
      this.svgStyleAdapter.defaultNeg(),
      this.svgStyleAdapter.defaultNeu()
    );

    if (CompareUtil.isExisting(data.pos)) {
      styleGroup.pos = this.svgStyleAdapter.adapt(data.pos);
    }

    if (CompareUtil.isExisting(data.neg)) {
      styleGroup.neg = this.svgStyleAdapter.adapt(data.neg);
    }

    if (CompareUtil.isExisting(data.pp)) {
      styleGroup.neu = this.svgStyleAdapter.adapt(data.neu);
    }

    if (CompareUtil.isString(data.needleHeadColour)) {
      styleGroup.needleHeadColour = data.needleHeadColour;
    }


    return styleGroup;
  }

  default(): SVGVariancesStyleGroup {
    return new SVGVariancesStyleGroup(this.svgStyleAdapter.defaultPos(),
      this.svgStyleAdapter.defaultNeg(),
      this.svgStyleAdapter.defaultNeu(),
    );
  }
}
