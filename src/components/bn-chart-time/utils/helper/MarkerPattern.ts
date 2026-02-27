// import { SVGPolgonPattern } from "../../../../utils/model";

import { SVGPolgonPattern } from "../../../../utils/model";

export class MarkerPattern {
  markerUp: { top: string; left: string; right: string };

  markerDown: { left: string; right: string; bottom: string };

  markerUpBackground: { top: string; left: string; right: string };

  markerDownBackground: { left: string; right: string; bottom: string };

  bgOffset: number;

  private markerRight: { top: string; bottom: string; right: string };
  private markerRightBackground: { top: string; bottom: string; right: string };
  private markerLeft: { top: string; left: string; bottom: string };
  private markerLeftBackground: { Left: string; top: string; bottom: string };
  constructor(fontSize: number) {
    const backgroundFactor = 1;
    const foregroundFactor = 0.7;

    const maxBg = fontSize * backgroundFactor;
    const maxFg = fontSize * foregroundFactor;

    this.bgOffset = (maxBg - maxFg) / 2;

    this.markerUp = { top: maxFg / 2 + ",0", left: "0," + maxFg, right: maxFg + "," + maxFg };

    this.markerUpBackground = { top: maxBg / 2 + ",0", left: "0," + maxBg, right: maxBg + "," + maxBg };

    this.markerDown = { bottom: maxFg / 2 + "," + maxFg, left: "0,0", right: maxFg + ",0" };

    this.markerDownBackground = { bottom: maxBg / 2 + "," + maxBg, left: "0,0", right: maxBg + ",0" };

    this.markerRight = { bottom: "0," + maxFg, top: "0,0", right: maxFg + "," + maxFg / 2 };

    this.markerRightBackground = { bottom: "0," + maxBg, top: "0,0", right: maxBg + "," + maxBg / 2 };

    this.markerLeft = { bottom: maxFg + "," + maxFg, top: maxFg + ",0", left: "0," + maxFg / 2 };

    this.markerLeftBackground = { bottom: maxBg + "," + maxBg, top: maxBg + ",0", Left: "0," + maxBg / 2 };
  }

  upMarkerPatternStrings(): SVGPolgonPattern {
    return {
      background:
        this.markerUpBackground.left +
        " " +
        this.markerUpBackground.right +
        " " +
        this.markerUpBackground.top +
        " " +
        this.markerUpBackground.left,
      foreground: this.markerUp.left + " " + this.markerUp.right + " " + this.markerUp.top + " " + this.markerUp.left,
      bgOffset: this.bgOffset,
    };
  }
  downMarkerPatternStrings(): SVGPolgonPattern {
    return {
      background:
        this.markerDownBackground.left +
        " " +
        this.markerDownBackground.right +
        " " +
        this.markerDownBackground.bottom +
        " " +
        this.markerDownBackground.left,
      foreground:
        this.markerDown.left + " " + this.markerDown.right + " " + this.markerDown.bottom + " " + this.markerDown.left,
      bgOffset: this.bgOffset,
    };
  }

  rightMarkerPatternStrings() {
    return {
      background:
        this.markerRightBackground.top +
        " " +
        this.markerRightBackground.right +
        " " +
        this.markerRightBackground.bottom +
        " " +
        this.markerRightBackground.top,
      foreground:
        this.markerRight.top +
        " " +
        this.markerRight.right +
        " " +
        this.markerRight.bottom +
        " " +
        this.markerRight.top,
      bgOffset: this.bgOffset,
    };
  }

  leftMarkerPatternStrings() {
    return {
      background:
        this.markerLeftBackground.top +
        " " +
        this.markerLeftBackground.Left +
        " " +
        this.markerLeftBackground.bottom +
        " " +
        this.markerLeftBackground.top,
      foreground:
        this.markerLeft.top + " " + this.markerLeft.left + " " + this.markerLeft.bottom + " " + this.markerLeft.top,
      bgOffset: this.bgOffset,
    };
  }

  createPatternMapForStructureBar(): Map<string, SVGPolgonPattern> {
    const pattern: Map<string, SVGPolgonPattern> = new Map();
    pattern.set("marker-up", this.upMarkerPatternStrings());
    pattern.set("marker-down", this.downMarkerPatternStrings());
    pattern.set("marker-right", this.rightMarkerPatternStrings());
    pattern.set("marker-left", this.leftMarkerPatternStrings());
    return pattern;
  }
}
