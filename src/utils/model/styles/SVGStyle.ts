import { IAdapter } from "../../helper/IAdapter";
import { CompareUtil } from "../../helper/CompareUtil";

export class SVGStyle {
  public fillpattern: string | undefined;
  public dasharray: string | undefined;

  constructor(
    public stroke: string = "#000000",
    public fill: string = "#000000",
    public width: number = 0.1,
  ) {}
}

export class SVGStyleAdapter implements IAdapter<SVGStyle> {
  adapt(data: Record<string, unknown>): SVGStyle {
    const style = new SVGStyle(data.stroke as string, data.fill as string, data.width as number);

    if (CompareUtil.isString(data.fillpattern)) {
      style.fillpattern = data.fillpattern;
    }

    if (CompareUtil.isString(data.dasharray)) {
      style.dasharray = data.dasharray;
    }

    return style;
  }

  default(): SVGStyle {
    return new SVGStyle("#000000", "#000000", 0.3);
  }

  defaultAC(): SVGStyle {
    return new SVGStyle("#000000", "#000000", 0.3);
  }

  defaultFC(): SVGStyle {
    const style = new SVGStyle("#000000", "#000000", 0.3);
    style.dasharray = "10 5 5 5";
    style.fillpattern = "fc";
    return style;
  }

  defaultPP(): SVGStyle {
    return new SVGStyle("#999999", "#999999", 0.3);
  }

  defaultPL(): SVGStyle {
    return new SVGStyle("#000000", "#ffffff", 0.3);
  }

  defaultPos(): SVGStyle {
    return new SVGStyle("#00ff00", "#00ff00", 0.3);
  }

  defaultNeg(): SVGStyle {
    return new SVGStyle("#ff0000", "#ff0000", 0.3);
  }

  defaultNeu(): SVGStyle {
    return new SVGStyle("#999999", "#999999", 0.3);
  }
}
