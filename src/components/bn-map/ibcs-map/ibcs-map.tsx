import {Component, h, Host,  Method, Prop, Watch, Event, EventEmitter} from "@stencil/core";
// @ts-ignore
import L from "leaflet-gpx";
import { Marker } from "./utils/model/Marker";
import { GpxLayer } from "./utils/model/GpxLayer";
import { GeoJsonLayer } from "./utils/model/GeoJsonLayer";
import { ComponentStatus } from "../../../utils/componentRegister";
// import { ComponentStatus } from "@bino-bi/ibcs-component-interface";
// import { DataUriUtil } from "../../utils/DataUriUtil";
// import { GeoJSON } from "geojson";




@Component({
  tag: "ibcs-map",
  styleUrl: 'ibcs-map.scss',
  assetsDirs: ['assets'],
})


export class IbcsMap {
  @Method()
  async setProps(data: Partial<IbcsMap>) {
    Object.keys(data).forEach((key) => {
      //@ts-ignore
      this[key] = data[key]; 
    })
  }

  @Method()
  async unSetProps(data: Partial<IbcsMap>) {
    Object.keys(data).forEach((key) => {
      //@ts-ignore
      this[key] = undefined; 
    })
  }

  drawElement: HTMLElement | undefined;

  //@Prop() tileLayer: string = 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.png';

  private _tileLayer: string = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  @Prop({ mutable: true, reflect: true })  
  public tileLayer: string = this._tileLayer;
  @Watch("tileLayer")
  parseTileLayer(tileLayer: any) {    
      this._tileLayer = tileLayer;       
  }
 

  private _manualPosOverride: boolean = true;
  @Prop({ mutable: true, reflect: true })  
  public manualPosOverride: boolean = this._manualPosOverride;
  @Watch("manualPosOverride")
  parseManualPosOverride(manualPosOverride: any) {      
      this._manualPosOverride = JSON.parse(manualPosOverride);      
  }

  private _latitude: number = 50.137634;
  @Prop({ mutable: true, reflect: true })  
  public latitude: number = this._latitude;
  @Watch("latitude")
  parseLatitude(latitude: any) {      
      this._latitude = Number(latitude);      
  }

  private _longitude: number = 8.679129;
  @Prop({ mutable: true, reflect: true })  
  public longitude: number = this._longitude;
  @Watch("longitude")
  parseLongitude(longitude: any) {    
      this._longitude = Number(longitude);      
  }


  private _scale: number = 11;
  @Prop({ mutable: true, reflect: true })  
  public scale: number = this._scale;
  @Watch("scale")
  parseScale(scale: any) {
      this._scale = Number(scale);      
  }

  private _customView: boolean = false;
  @Prop({ mutable: true, reflect: true })  
  public customView: boolean = this._customView;
  @Watch("customView")
  parseCustomView(customView: any) {    
      this._customView = JSON.parse(customView);     
  }

  private _showScale: boolean = false;
  @Prop({ mutable: true, reflect: true })  
  public showScale: boolean = this._showScale;
  @Watch("showScale")
  parseShowScale(showScale: any) {    
      this._showScale = JSON.parse(showScale);     
  }


  private _showZoom: boolean = false;
  @Prop({ mutable: true, reflect: true })  
  public showZoom: boolean = this._showZoom;
  @Watch("showZoom")
  parseShowZoom(showZoom: any) {
      this._showZoom = JSON.parse(showZoom);       
  }


  private _attribution: string = '';
  @Prop({ mutable: true, reflect: true })  
  public attribution: string = this._attribution;
  @Watch("attribution")
  parseAttribution(attribution: any) {
      this._attribution = attribution;       
  }

  private _gpxs: GpxLayer[] = [];
  @Prop({ mutable: true, reflect: true })  
  public gpxs: GpxLayer[] | string = this._gpxs;  
  @Watch("gpxs")
  parseGpxLayers(gpxs: any) {       
    if (typeof gpxs === "string") {
      this._gpxs = JSON.parse(gpxs);    
    } else {
      this._gpxs = gpxs;
    }   
   
    this.gpxLayerUpdate(this._gpxs)
  }

  private _markers: Marker[] = [];
  @Prop({ mutable: true, reflect: true })  
  public markers: Marker[] | string = this._markers;
  @Watch("markers")
  parseMarkers(markers: any) {
    if (typeof markers === "string") {
      this._markers = JSON.parse(markers);
    } else {
      this._markers = markers;
    }      
  
    this.mapMarkerUpdate(this._markers)
  }

  private _geojsons: GeoJsonLayer[] = [];
  @Prop({ mutable: true, reflect: true })  
  public geojsons: GeoJsonLayer[] | string = this._geojsons;
  @Watch("geojsons")
  parseGeoJson(geojsons: any) {      
    if (typeof geojsons === "string") {
      this._geojsons = JSON.parse(geojsons);
    } else {
      this._geojsons = geojsons;
    }      
  
    this.geoJsonUpdate(this._geojsons)
  }

  // @ts-ignore
  @Event() stateUpdated: EventEmitter<any>;
  // @ts-ignore
  @Event() dragZoomEnded: EventEmitter<any>;

  private lmap: any = null;
  private gpxLayer: any = [];
  private mapMarker: any = [];
  private geoJsonLayer: any = [];
  
   // @ts-ignore
  private scaleControl = L.control.scale();
   // @ts-ignore
  private zoomControl = L.control.zoom();
  // @ts-ignore
  private tileLayerControl = L.tileLayer(this._tileLayer);


  private cumlatedBounds: any = {
    northEast: null,
    southWest: null
  };

  render() {   
    return (
      <Host>
        <div ref={(el) => this.drawElement = el as HTMLElement} id="map" class="map"></div>
      </Host>
    );
  }


  gpxLayerUpdate(gpxOptionsLayers: GpxLayer[]) {        
    this.gpxLayer.forEach((layer: any) => {   
         layer.remove();     
    });

    this.gpxLayer = [];   

    for (const gpxOptions of gpxOptionsLayers) {
        if (gpxOptions == undefined) {
          continue;
        }
        const regex = /^data:application\/octet-stream;/;    
        let decodedData  = gpxOptions.file;
        
        if(regex.test(gpxOptions.file)) {
            const dataPart = gpxOptions.file.split(',')[1];
            decodedData = atob(dataPart);
        }

        // @ts-ignore
        this.gpxLayer.push(new L.GPX(decodedData, {            
          async: true,       
          marker_options: {
            startIconUrl: gpxOptions.startIconUrl,
            endIconUrl:   gpxOptions.endIconUrl,
            shadowUrl:    gpxOptions.shadowUrl,
          },
          polyline_options :{
            color: gpxOptions.color,
            opacity: gpxOptions.opacity,
            lineCap: gpxOptions.lineCap,
            weight: gpxOptions.weight,
          }
        }).on('loaded', (e: any) => {
          console.log("GPX Loaded ",e);
          this.updateCumulatedBounds(e);
          if(  this._manualPosOverride == false) {
            this.lmap.fitBounds([this.cumlatedBounds.northEast, this.cumlatedBounds.southWest]);
          }    
          this.stateUpdated.emit(ComponentStatus.SUCCESSFUL);
        }));
    }
   
  }


  private updateCumulatedBounds(e: any) {
    if (this.cumlatedBounds.northEast == null) {
      this.cumlatedBounds.northEast = {
        lat: e.target.getBounds().getNorthEast().lat,
        lng: e.target.getBounds().getNorthEast().lng
      };
    }

    if (this.cumlatedBounds.southWest == null) {
      this.cumlatedBounds.southWest = {
        lat: e.target.getBounds().getSouthWest().lat,
        lng: e.target.getBounds().getSouthWest().lng
      };
    }

    if (e.target.getBounds().getNorthEast().lat > this.cumlatedBounds.northEast.lat) {
      this.cumlatedBounds.northEast.lat = e.target.getBounds().getNorthEast().lat;
    }

    if (e.target.getBounds().getNorthEast().lng > this.cumlatedBounds.northEast.lng) {
      this.cumlatedBounds.northEast.lng = e.target.getBounds().getNorthEast().lng;
    }

    if (e.target.getBounds().getSouthWest().lat < this.cumlatedBounds.southWest.lat) {
      this.cumlatedBounds.southWest.lat = e.target.getBounds().getSouthWest().lat;
    }

    if (e.target.getBounds().getSouthWest().lng < this.cumlatedBounds.southWest.lng) {
      this.cumlatedBounds.southWest.lng = e.target.getBounds().getSouthWest().lng;
    }
  }

  
  mapMarkerUpdate(markes: Marker[]) {
    this.mapMarker.forEach((layer: any) => {   
      layer.remove();     
    });

    this.mapMarker = [];   

    for (const markerOptions of markes) {
                // Icon options
                let iconOptions = {
                  iconUrl: markerOptions.iconUrl,
                  iconSize: [markerOptions.iconWidth, markerOptions.iconHeight]
                }

                // @ts-ignore
                let customIcon = L.icon(iconOptions);

                let options = {
                  title: markerOptions.title,
                  icon: customIcon
                }

                // @ts-ignore
                this.mapMarker.push(L.marker([markerOptions.latitude, markerOptions.longitude], options));
    }
  }

  geoJsonUpdate(geojsons: GeoJsonLayer[]) {
    this.geoJsonLayer.forEach((layer: any) => {   
      layer.remove();     
    }); 

    this.geoJsonLayer = [];       
    for (const geoJson of geojsons) {          
      
      var jsonStyle = {
        "color": geoJson.color,
        "weight": geoJson.weight,
        "opacity": geoJson.opacity,
        "lineCap": geoJson.lineCap,
      };
      
      let options = {
        style: jsonStyle
      };
      // @ts-ignore      
      this.geoJsonLayer.push(L.geoJSON(DataUriUtil.dataURItoObject(geoJson.file), options)     
      );
    }
  }

  

  componentWillLoad() {
    this.stateUpdated.emit(ComponentStatus.RUNNING);
    this.parseMarkers(this.markers);
    this.parseGeoJson(this.geojsons);
    this.parseGpxLayers(this.gpxs);
    this.parseAttribution(this.attribution);
    this.parseShowZoom(this.showZoom);
    this.parseShowScale(this.showScale);
    this.parseScale(this.scale);
    this.parseLongitude(this.longitude);
    this.parseLatitude(this.latitude);
    this.parseTileLayer(this.tileLayer);

  }
  

  componentDidLoad() {
    if (this.drawElement == null) {
      return;
    }
    // @ts-ignore
    this.lmap = L.map(this.drawElement, { zoomControl: false });
   
    this.setView();
    this.setTileLayer();

    this.setGeoJsonLayer();
    this.setGPXLayer();
    this.setMarker()

    this.setShowScale();
    this.setShowZoom();
    this.setAttribution();
    
    this.lmap.addEventListener("dragend" , this.dragZoomEnd.bind(this));
    this.lmap.addEventListener("zoomend" , this.dragZoomEnd.bind(this)); 
  }

 
  disconnectedCallback() {
    this.lmap.removeEventListener("dragend", this.dragZoomEnd.bind(this));
    this.lmap.removeEventListener("zoomend", this.dragZoomEnd.bind(this));
  }


  componentDidUpdate() {
    if (this.drawElement == null) {
      return;
    }

    this.setView();
    this.setTileLayer();
    this.setGeoJsonLayer();
    this.setGPXLayer();
    this.setMarker()

    this.setShowScale();
    this.setShowZoom();
    this.setAttribution()
    
  }

  dragZoomEnd(){
      const {lat , lng} = this.lmap.getCenter();      
      const zoom = this.lmap.getZoom();       
      this.dragZoomEnded.emit({
        longitude: lng,
        latitude: lat,
        scale: zoom
        }
      );
  }
 
  setView(): void {
    //if(this._customView == false) {
    //  return;
    //}

    this.lmap.setView([this._latitude, this._longitude], this._scale);
  }

  setTileLayer(): void {   
    this.tileLayerControl.setUrl(this._tileLayer, true)
    this.tileLayerControl.addTo(this.lmap);
  }


  setAttribution(): void {
    this.lmap.attributionControl.setPrefix(this._attribution);
  }

  setShowScale(): void {
    this.scaleControl.remove();    
    if (this._showScale == true) { 
      this.scaleControl.addTo(this.lmap);   
    }   
  }

  setShowZoom(): void {
    this.zoomControl.remove(); 
    if (this._showZoom == true) {  
      this.zoomControl.addTo(this.lmap);   
    } 
  }
  

  setGPXLayer(): void {    
    this.gpxLayer.forEach((layer: any) => {
      try {    
        layer.addTo(this.lmap);
      } catch (e) {
        console.error("gpxLayer", e);
      }
    });

  }

  setMarker(): void {  
    this.mapMarker.forEach((layer: any) => {
      try {     
        layer.addTo(this.lmap);
      } catch (e) {
        console.error("markerLayer", e);
      }
    });
  }

  setGeoJsonLayer(): void {  
    this.geoJsonLayer.forEach((layer: any) => {
      try {    
        layer.addTo(this.lmap);
      } catch (e) {
        console.error("gpxLayer", e);
      }
    });
  }
}
