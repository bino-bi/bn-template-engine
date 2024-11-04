import { IAdapter } from "../../helper/IAdapter";
import { CompareUtil } from "../../helper/CompareUtil";

export class Padding {
  public top: number = 10;
  public left: number = 10;
  public right: number = 10;
  public bottom: number = 10;
}

export class PaddingAdapter implements IAdapter<Padding> {
  adapt(data: any): Padding {
    const padding = new Padding();

    if (CompareUtil.isNumber(data.top)) {
      padding.top = data.top;
    }

    if (CompareUtil.isNumber(data.left)) {
      padding.left = data.left;
    }

    if (CompareUtil.isNumber(data.right)) {
      padding.right = data.right;
    }

    if (CompareUtil.isNumber(data.bottom)) {
      padding.bottom = data.bottom;
    }

    return padding;
  }

  default(): Padding {
    return new Padding();
  }


}
