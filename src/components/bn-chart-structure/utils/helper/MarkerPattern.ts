// import { SVGPolgonPattern } from "../../../../utils/model";

import { SVGPolgonPattern } from "../../../../utils/model";

export class MarkerPattern {
  markerUp: { top: string; left: string; right: string };

  markerDown: { left: string; right: string; bottom: string };

  markerUpBackground: { top: string; left: string; right: string };

  markerDownBackground: { left: string; right: string; bottom: string };

  bgOffset: number;

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

  createPatternMapForStructureBar(): Map<string, SVGPolgonPattern> {
    const pattern: Map<string, SVGPolgonPattern> = new Map();
    pattern.set("marker-up", this.upMarkerPatternStrings());
    pattern.set("marker-down", this.downMarkerPatternStrings());

    return pattern;
  }
}
