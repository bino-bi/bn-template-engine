import {Component, h, Host, Prop, Watch} from '@stencil/core';
import {isValidBoolean, isValidNumber} from "../../utils/validate";
import {isEmpty, isString} from "lodash";

type MarkerParams = {
  latitude: number;
  longitude: number;
  iconUrl: string;
  iconWidth: number;
  iconHeight: number;
}

type GpxParams = {
  file: string;
  color: string;
  opacity: number;
  weight: number;
  lineCap: string;
}


@Component({
  tag: 'bn-map',
  styleUrl: 'bn-map.css',
  shadow: true,
})
export class BnMap {

  private markersList: MarkerParams[] = [];
  private gpxList: GpxParams[] = []

  /**
   * Latitude of the maps viewport center,
   * the selected value will be ignored if gpx files are
   * selected
   */
  @Prop({mutable: false}) latitude: number = 50.137634;

  @Watch('latitude')
  validateLatitude(newValue: number) {
    if (!isValidNumber(newValue)) {
      throw new Error('latitude: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * Latitude of the maps viewport center,
   * the selected value will be ignored if gpx files are
   * selected
   */
  @Prop({mutable: false}) longitude: number = 8.679129;

  @Watch('longitude')
  validateLongitude(newValue: number) {
    if (!isValidNumber(newValue)) {
      throw new Error('longitude: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * scale / zoom factor of the maps viewport.
   * Decrease the value to zoom out.
   * Increase the value to zoom in.
   * the selected value will be ignored if gpx files are
   * selected
   */
  @Prop({mutable: false}) scale: number = 11;

  @Watch('scale')
  validateScale(newValue: number) {
    if (!isValidNumber(newValue)) {
      throw new Error('scale: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * Activates/ Deactivates Map Scale
   */
  @Prop() showScale: boolean = false;

  @Watch('showScale')
  validateShowScale(newValue: boolean) {
    if (!isValidBoolean(newValue)) {
      throw new Error('scale: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * Set Footer label
   */
  @Prop() attribution: string = '';

  @Watch('attribution')
  validateAttribution(newValue: string) {
    if (!isString(newValue)) {
      throw new Error('attribution: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * URL for maplayer provider
   * example provers https://leaflet-extras.github.io/leaflet-providers/preview/
   */
  @Prop() titleLayer: string = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

  @Watch('titleLayer')
  validateTitleLayer(newValue: string) {
    if (!isString(newValue)) {
      throw new Error('titleLayer: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * Marker Parameter
   * example [{"latitude": 50.137634,
   *           "longitude": 8.679129,
   *           "iconUrl": "http://localhost:3333/build/assets/icons/marker-example.png",
   *           "iconWidth": 64,
   *           "iconHeight":64}]
   *
   */
  @Prop() markers: string | null = null;

  @Watch('markers')
  validateMarkers(newValue: string | null) {
    if (isEmpty(newValue)) {
      return;
    }

    try {
      this.markersList = JSON.parse(newValue);
    } catch (e) {
      throw new Error('gpxs: invalid value(s) \'' + newValue + '\' are not supported.:' + e.message);
    }
  }

  /**
   * GPX Parameter
   * example ["file": "http://URL_TO_GPX.gpx",
   *          "color": "#FC5200",
   *          "opacity": 0.75,
   *          "weight": 3,
   *          "lineCap": "round"}]
   */
  @Prop() gpxs: string | null = null;

  @Watch('gpxs')
  validateGpx(newValue: string | null) {

    if (isEmpty(newValue)) {
      return;
    }

    try {
      this.gpxList = JSON.parse(newValue);
    } catch (e) {
      throw new Error('gpxs: invalid value(s) \'' + newValue + '\' are not supported.:' + e.message);
    }
  }


  componentWillLoad() {
    console.log("will load ");
    this.validateLatitude(this.latitude);
    this.validateLongitude(this.longitude);
    this.validateScale(this.scale);
    this.validateShowScale(this.showScale);
    this.validateAttribution(this.attribution);
    this.validateTitleLayer(this.titleLayer);
    this.validateMarkers(this.markers);
    this.validateGpx(this.gpxs);
    console.log("did will load ");
  }

  render() {
    return (
      <Host>
        <ibcs-map attribution={this.attribution} tile-layer={this.titleLayer} latitude={this.latitude}
                  longitude={this.longitude} scale={this.scale} show-scale={this.showScale}>
          {this.markersList.map(this.createMarker)}
          {this.gpxList.map(this.createGPX)}
        </ibcs-map>
      </Host>
    );
  }

  private createMarker(marker: MarkerParams): any {
    console.log("Marker", marker);
    return <map-marker latitude={marker.latitude} longitude={marker.longitude} icon-url={marker.iconUrl}
                       icon-width={marker.iconWidth} icon-height={marker.iconHeight}/>
  }

  private createGPX(gpx: GpxParams): any {
    console.log("GpxParams", gpx);
    return <gpx-layer file={gpx.file} color={gpx.color} opacity={gpx.opacity} weight={gpx.weight}
                      line-cap={gpx.lineCap}></gpx-layer>
  }

}
