import { getAssetPath } from "@stencil/core";

export class Marker {
  public latitude: number;
  public longitude: number;
  public iconUrl: string;
  public iconWidth: number;
  public iconHeight: number;
  public title: string;

  constructor(
    latitude: number = 51.505,
    longitude: number = -0.12,
    iconUrl: string = getAssetPath("assets/icons/pin.png"),
    iconWidth: number = 64,
    iconHeight: number = 64,
    title: string = "",
  ) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.iconUrl = iconUrl;
    this.iconWidth = iconWidth;
    this.iconHeight = iconHeight;
    this.title = title;
  }
}
