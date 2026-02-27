export class GeoJsonLayer {
  public file: string;
  public color: string;
  public opacity: number;
  public lineCap: string;
  public weight: number;
  constructor(
    file: string = "",
    color: string = "#008f96",
    opacity: number = 0.75,
    lineCap: string = "round",
    weight: number = 3,
  ) {
    this.file = file;
    this.color = color;
    this.opacity = opacity;
    this.lineCap = lineCap;
    this.weight = weight;
  }
}
