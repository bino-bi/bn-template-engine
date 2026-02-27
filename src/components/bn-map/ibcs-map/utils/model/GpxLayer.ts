import { getAssetPath } from "@stencil/core";

export class GpxLayer {
  public file: string;
  public color: string;
  public opacity: number;
  public lineCap: string;
  public startIconUrl: string;
  public endIconUrl: string;
  public shadowUrl: string;
  public weight: number;
  constructor(
    file: string = getAssetPath("assets/gpx/Chasing_Legends.gpx"),
    color: string = "#008f96",
    opacity: number = 0.75,
    lineCap: string = "round",
    startIconUrl: string = getAssetPath("assets/icons/gpx-start.png"),
    endIconUrl: string = getAssetPath("assets/icons/gpx-finish.png"),
    shadowUrl: string = getAssetPath("assets/icons/gpx-shadow.png"),
    weight: number = 3,
  ) {
    this.file = file;
    this.color = color;
    this.opacity = opacity;
    this.lineCap = lineCap;
    this.startIconUrl = startIconUrl;
    this.endIconUrl = endIconUrl;
    this.shadowUrl = shadowUrl;
    this.weight = weight;
  }
}
