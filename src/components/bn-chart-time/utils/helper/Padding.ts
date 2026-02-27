import { Box } from "../model";

export class Padding {
  public top: number;
  public bottom: number;
  public left: number;
  public right: number;

  constructor(padding: { top: number; left: number; right: number; bottom: number }) {
    this.top = padding.top;
    this.bottom = padding.bottom;
    this.left = padding.left;
    this.right = padding.right;
  }

  public addBoxTopLeft(addition: Box): Padding {
    this.top += addition.height | this.top;
    this.left += addition.width | this.top;
    return this;
  }
}
