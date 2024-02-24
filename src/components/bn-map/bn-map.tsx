import {Component, h, Host,  Listen,  Prop, State, Watch} from '@stencil/core';
import {isValidBoolean, isValidNumber, validateGeoJsonType, validateGpxType, validateMarkerType} from "../../utils/validate";
import {isEmpty, isString} from "lodash";
import {withStyled} from "../../utils/styled/withStyled";
import withComponentStatus from "../../utils/withComponentStatus";
import withDataset from "../../utils/withDataset";
import withHasError, {ErrorDispatcher} from "../../utils/withHasError";
import { GeoJSON } from "geojson";
import { ComponentStatus } from '@bino-bi/ibcs-component-interface';

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
  startIconUrl: string;
  endIconUrl: string;
  shadowUrl: string;
}

@Component({
  tag: 'bn-map',
  styleUrl: 'bn-map.css',
  shadow: true,
})
export class BnMap {
  //private readonly t: (key: string, data?: object) => string;
  private readonly errors: ErrorDispatcher;

  private markerList: MarkerParams[] = [];
  private gpxList: GpxParams[] = []
  private geoJsonList: GeoJSON[] = []

 //  @State() gpxdata: GpxParams[] = [];
  @State() gpxData:    GpxParams[] = [];
  @State() markerData: MarkerParams[] = [];
  @State() geoJsonData: GeoJSON[] = [];
  @State() data: any[] = [];


  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    withDataset(this, (name, data) => {
      if(name == this.markersDatasetName) {
          this.markerData = data;
      } else if(name == this.gpxsDatasetName) {
          this.gpxData = data;
      }
    });
    //this.t = withTranslation(this).t;
  }

  /**
   * Name of the makers Dataset used in map
   *
   * default: $markers
   */
  @Prop({mutable: false}) markersDatasetName: string = "$markers";
  @Watch('markersDatasetName')
  validateMarkerDatasetName(newValue: number) {
    const errId: string = 'ERR_markersDatasetName';

    if (!isString(newValue)) {
      this.errors.addOrReplace({id: errId, type: 'warning', message:'markerDatasetName: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Name of the gpxs Dataset used in map
   *
   * default: $gpxs
   */
  @Prop({mutable: false}) gpxsDatasetName: string = "$gpxs";
  @Watch('gpxsDatasetName')
  validateGpxsDatasetName(newValue: number) {
    const errId: string = 'ERR_gpxsDatasetName';

    if (!isString(newValue)) {
      this.errors.addOrReplace({id: errId, type: 'warning', message:'gpxsDatasetName: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }
  /**
   * Latitude of the maps viewport center,
   * the selected value will be ignored if gpx files are
   * selected
   */
  @Prop({mutable: true}) latitude: number = 50.137634;

  @Watch('latitude')
  validateLatitude(newValue: number) {
    const errId: string = 'ERR_latitude';

    if (!isValidNumber(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message:'latitude: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Latitude of the maps viewport center,
   * the selected value will be ignored if gpx files are
   * selected
   */
  @Prop({mutable: true}) longitude: number = 8.679129;

  @Watch('longitude')
  validateLongitude(newValue: number) {
    const errId: string = 'ERR_longitude';

    if (!isValidNumber(newValue)) {
      this.errors.addOrReplace({  id: errId, type: 'warning', message:'longitude: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * scale / zoom factor of the maps viewport.
   * Decrease the value to zoom out.
   * Increase the value to zoom in.
   * the selected value will be ignored if gpx files are
   * selected
   */
  @Prop({mutable: true}) scale: number = 11;

  @Watch('scale')
  validateScale(newValue: number) {
    const errId: string = 'ERR_scale';

    if (!isValidNumber(newValue)) {
      this.errors.addOrReplace({ id: errId,  type: 'warning', message:'scale: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Activates/ Deactivates Map Scale
   */
  @Prop() showScale: boolean = false;

  @Watch('showScale')
  validateShowScale(newValue: boolean) {
    const errId: string = 'ERR_showScale';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({  id: errId, type: 'warning', message:'showScale: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Set Footer label
   */
  @Prop() attribution: string = '';

  @Watch('attribution')
  validateAttribution(newValue: string) {
    const errId: string = 'ERR_attribution';

    if (!isString(newValue)) {
      this.errors.addOrReplace({
        id: errId,
        type: 'warning',
        message: 'attribution: invalid value(s) \'' + newValue + '\' are not supported.'
      });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * URL for maplayer provider
   * example provers https://leaflet-extras.github.io/leaflet-providers/preview/
   */
  @Prop() tileLayer: string = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

  @Watch('tileLayer')
  validateTileLayer(newValue: string) {
    const errId: string = 'ERR_tileLayer';

    if (!isString(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message:'tileLayer: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_markers';
    const errIdJson: string = 'ERR_markersJSON';
    try {
      const invalidScenarios: string[] = validateMarkerType(newValue);


      if (invalidScenarios.length > 0) {
        this.errors.addOrReplace({ id: errId, type: 'warning', message:'Markers: invalid value(s) \'' + invalidScenarios + '\' are not supported.'});
      } else {
        this.errors.remove(errId);
      }

      this.markerList = JSON.parse(newValue);
      this.errors.remove(errIdJson);
    } catch (e) {
      this.errors.addOrReplace({id: errIdJson, type: 'warning', message:'Markers: invalid value(s) \'' + newValue + '\' are not supported.:' + e.message});
    }
  }

  /**
   * GPX Parameter
   * example ["file": "http://URL_TO_GPX.gpx",
   *          "color": "#FC5200",
   *          "opacity": 0.75,
   *          "weight": 3,
   *          "lineCap": "round"}]
   *          */
  @Prop() gpxs: string | null = null;

  @Watch('gpxs')
  validateGpx(newValue: string | null) {

    if (isEmpty(newValue)) {
      return;
    }
    const errId: string = 'ERR_gpxs';
    const errIdJson: string = 'ERR_gpxsJSON';
    try {
      console.log("validateGpx", newValue );
      const invalidScenarios: string[] = validateGpxType(newValue);
      if (invalidScenarios.length > 0) {
        this.errors.addOrReplace({ id: errId, type: 'warning', message:'gpxs: invalid value(s) \'' + invalidScenarios + '\' are not supported.'});
      } else {
        this.errors.remove(errId);
      }

      this.gpxList = JSON.parse(newValue);
      this.errors.remove(errIdJson);
    } catch (e) {
      this.errors.addOrReplace({id: errIdJson, type: 'warning', message:'gpxs: invalid  \'' + newValue + '\' is not supported.:' + e.message});
    }
  }

  @Prop() geojsons: string | null = null;

  @Watch('geojsons')
  validateGeoJson(newValue: string | null) {

    if (isEmpty(newValue)) {
      return;
    }
    const errId: string = 'ERR_geojsons';
    const errIdJson: string = 'ERR_geojsons';
    try {
      console.log("validateGeoJson", newValue );
      const invalidScenarios: string[] = validateGeoJsonType(newValue);
      if (invalidScenarios.length > 0) {
        this.errors.addOrReplace({ id: errId, type: 'warning', message:'geojsosn: invalid value(s) \'' + invalidScenarios + '\' are not supported.'});
      } else {
        this.errors.remove(errId);
      }

      this.geoJsonList = JSON.parse(newValue);
      console.log("geoJsonList",  this.geoJsonList  );
      this.errors.remove(errIdJson);
    } catch (e) {
      this.errors.addOrReplace({id: errIdJson, type: 'warning', message:'geojsons: invalid  \'' + newValue + '\' is not supported.:' + e.message});
    }
  }
  
  
  // @ts-ignore
  @Event() bnStateUpdated: EventEmitter<any>;
    // @ts-ignore
  @Event() bnDragZoomEnded: EventEmitter<any>;

  @Listen('stateUpdated')
  stateUpdated(status: any) {    
    console.log("stateUpdated", status.detail);
    this.bnStateUpdated.emit(ComponentStatus.SUCCESSFUL);
  }

  @Listen('dragZoomEnded')
  dragZoomEnded(props: any) {       
    this.bnDragZoomEnded.emit(props.detail);
  }


  componentWillLoad() {
    this.validateLatitude(this.latitude);
    this.validateLongitude(this.longitude);
    this.validateScale(this.scale);
    this.validateShowScale(this.showScale);
    this.validateAttribution(this.attribution);
    this.validateTileLayer(this.tileLayer);
    this.validateMarkers(this.markers);
    this.validateGpx(this.gpxs);
    this.validateGeoJson(this.geojsons);
  }

  // this.prepareGeoJsonData()
  render() { 
      <Host>          
          <ibcs-map tile-layer={this.tileLayer}
                  latitude={this.latitude}  
                  longitude={this.longitude}
                  scale={this.scale}
                  show-scale={this.showScale}
                  show-zoom={false}
                  custom-view={true}
                  attribution={this.attribution}    
                  gpxs={this.prepareGpxData()} 
                  markers={this.prepareMarkerData()}
                  geojsons={this.prepareGeoJsonData()}
        >           
        </ibcs-map>
      </Host>
    ;
  }

 


  /*

        <ibcs-map customView = {true}
                    latitude={51.137634}
                    longitude={9.679129} 
                    scale = {10}
                    showScale = {false}
                    showZoom = {false}
                    attribution={"Jens ist Toll"}  
                    gpxs = {gpxExample} 
                    geojsons={geoJsonExample}
                    markers = {`[]`}
                    >           
          </ibcs-map>


           <ibcs-map tile-layer={this.tileLayer}
                  latitude={this.latitude}  
                  longitude={this.longitude}
                  scale={this.scale}
                  show-scale={this.showScale}
                  show-zoom={false}
                  custom-view={true}
                  attribution={this.attribution}    
                  gpxs={this.prepareGpxData()} 
                  markers={this.prepareMarkerData()}
                  geojsons={this.prepareGeoJsonData()}
        >           
        </ibcs-map>


        
  */

  private prepareMarkerData() {    
    return [...this.markerData, ...this.markerList];
  }

  private prepareGpxData() {  
     console.log("prepareGpxData: ", [ ...this.gpxData, ...this.gpxList]);
     return [ ...this.gpxData, ...this.gpxList];
  }

  private prepareGeoJsonData() {  
    console.log("prepareGeoJsonData: ", [ ...this.geoJsonData, ...this.geoJsonList]);
    return [ ...this.geoJsonData, ...this.geoJsonList];
 }


  public getDataStructureGpxParams(): any {
    let dataSetStructure: any = {
      GpxParams: {
        file: {type: "string", isOptional: false, description: ""},
        color: {type: "string", isOptional: false, description: ""},
        opacity: {type: "number", isOptional: false, description: ""},
        weight: {type: "number", isOptional: false, description: ""},
        lineCap: {type: "string", isOptional: false, description: ""},
        startIconUrl: {type: "string", isOptional: false, description: ""},
        endIconUrl: {type: "string", isOptional: false, description: ""},
        shadowUrl: {type: "string", isOptional: false, description: ""},
      }
    };

    return dataSetStructure;
  }

  public getDataStructureMarkerParams(): any {
    let dataSetStructure: any = {
      MarkerParams: {
        latitude: {type: "number", isOptional: false, description: ""},
        longitude: {type: "string", isOptional: false, description: ""},
        iconUrl: {type: "number", isOptional: false, description: ""},
        iconWidth: {type: "number", isOptional: false, description: ""},
        iconHeight: {type: "number", isOptional: false, description: ""},
        tile: {type: "string", isOptional: false, description: ""},
      }
    };

    return dataSetStructure;
  }
}
