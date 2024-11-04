import { IAdapter } from "../../helper/IAdapter";
import { SVGStyle, SVGStyleAdapter } from "./SVGStyle";
import { CompareUtil } from "../../helper/CompareUtil";


export class SVGStyleGroup {
  constructor(public ac: SVGStyle,
    public fc: SVGStyle,
    public pp: SVGStyle,
    public pl: SVGStyle) { }

  getSVGStyle(scenario: string | undefined) {
    if (scenario === 'ac') {
      return this.ac;
    }

    if (scenario === 'fc') {
      return this.fc;
    }

    if (scenario === 'pp') {
      return this.pp;
    }

    if (scenario === 'pl') {
      return this.pl;
    }

    return this.ac;
  }

}

export class SVGStyleGroupAdapter implements IAdapter<SVGStyleGroup> {
  constructor(private svgStyleAdapter: SVGStyleAdapter) {
  }

  adapt(data: any): SVGStyleGroup {
    const styleGroup: SVGStyleGroup = new SVGStyleGroup(this.svgStyleAdapter.defaultAC(),
      this.svgStyleAdapter.defaultFC(),
      this.svgStyleAdapter.defaultPP(),
      this.svgStyleAdapter.defaultPL());

    if (CompareUtil.isExisting(data.ac)) {
      styleGroup.ac = this.svgStyleAdapter.adapt(data.ac);
    }

    if (CompareUtil.isExisting(data.fc)) {
      styleGroup.fc = this.svgStyleAdapter.adapt(data.fc);
    }

    if (CompareUtil.isExisting(data.pp)) {
      styleGroup.pp = this.svgStyleAdapter.adapt(data.pp);
    }

    if (CompareUtil.isExisting(data.pl)) {
      styleGroup.pl = this.svgStyleAdapter.adapt(data.pl);
    }

    return styleGroup;
  }

  default(): SVGStyleGroup {
    return new SVGStyleGroup(this.svgStyleAdapter.defaultAC(),
      this.svgStyleAdapter.defaultFC(),
      this.svgStyleAdapter.defaultPP(),
      this.svgStyleAdapter.defaultPL());
  }
}
