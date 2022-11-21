import {Component, Host, h, Prop} from '@stencil/core';

@Component({
  tag: 'bn-map',
  styleUrl: 'bn-map.css',
  shadow: true,
})
export class BnMap {

  @Prop({mutable: true}) latitude: number = 50.137634;
  @Prop({mutable: true}) longitude: number = 8.679129;
  @Prop({mutable: true}) scale: number = 11;
  @Prop() showScale: boolean = false;
  @Prop() attribution: string = '';
  @Prop() titleLayer: string = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';



  render() {
    return (
      <Host>
        <ibcs-map attribution={this.attribution} tile-layer={this.titleLayer} latitude={this.latitude} longitude={this.longitude} scale={this.scale} show-scale={this.showScale} >
          {this.createMarker()}
          {this.createGPX()}
        </ibcs-map>
      </Host>
    );
  }

  private createMarker(): any {
    return <map-marker latitude={50.137634} longitude={8.679129} icon-url="http://localhost:3333/build/assets/icons/marker-example.png" icon-width={64} icon-height={64}/>
  }

  private createGPX(): any {
    return <gpx-layer file = {"http://localhost:3333/build/assets/gpx/Fahrt_am_Nachmittag.gpx"} color={"#FC5200"} opacity={0.75} weight={3} line-cap={"round"} > </gpx-layer>

  }

}
