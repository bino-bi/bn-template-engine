import { IAdapter } from "../../helper/IAdapter";
import { CompareUtil } from "../../helper/CompareUtil";

export class FontStyle {
  public font: string = "16px Arial";
  /**
   * Font family alone, without the size that {@link font} bakes into its CSS
   * shorthand. Charts write this onto the SVG as a presentation attribute so a
   * measured element carries its own font instead of inheriting one from
   * wherever it happens to be measured.
   */
  public family: string = "Arial";
  public size: number = 16;
  public color: string = "#000000";
  public background: string = "#ffffff";
  public leading: number = 1.8;

  constructor() {}
}

export class FontStyleAdapter implements IAdapter<FontStyle> {
  adapt(data: Record<string, unknown>): FontStyle {
    const fontStyle: FontStyle = new FontStyle();

    if (CompareUtil.isString(data.font)) {
      fontStyle.font = data.font;
    }

    if (CompareUtil.isString(data.family)) {
      fontStyle.family = data.family;
    }

    if (CompareUtil.isNumber(data.size)) {
      fontStyle.size = data.size;
    }

    if (CompareUtil.isString(data.color)) {
      fontStyle.color = data.color;
    }

    if (CompareUtil.isString(data.background)) {
      fontStyle.background = data.background;
    }

    if (CompareUtil.isNumber(data.leading)) {
      fontStyle.leading = data.leading;
    }

    return fontStyle;
  }

  default(): FontStyle {
    return new FontStyle();
  }
}
