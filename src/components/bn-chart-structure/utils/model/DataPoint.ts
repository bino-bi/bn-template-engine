import {Scenario} from './index';

export class DataPoint {

  public value: number | null;
  public scenario: Scenario | string | null;
  public pixelPerUnit: number;
  public variance: Scenario | string;

  constructor(value: number | null, scenario: Scenario | string | null, pixelPerUnit: number | null, variance: Scenario | string | null) {
    this.value = value;
    this.scenario = scenario;
    this.pixelPerUnit = pixelPerUnit || 1;

    if (variance === "neg" || variance === Scenario.NEG) {
      this.variance = Scenario.NEG;
    } else if (variance === "pos" || variance === Scenario.POS) {
      this.variance = Scenario.POS;
    } else {
      this.variance = Scenario.NEU;
    }
  }

  public isEmpty(): boolean {
    return null == this.value || null == this.scenario;
  }

  public getScaledUnit(): number {
    if (this.value == null) {
      return 0;
    }

    return this.value * this.pixelPerUnit;
  }

  public getScaledPercentUnit(): number {
    if (this.value == null) {
      return 0;
    }


    if (Math.abs(this.value) > 1.45) {
      if (this.value >= 0) {
        return 1.45 * this.pixelPerUnit;
      } else {
        return -1.45 * this.pixelPerUnit;
      }

    } else {

      return this.value * this.pixelPerUnit;
    }

  }


  public getVarianceStyle(): Scenario {
    if(this.value == null ){
      return this.variance as Scenario
    }

    if (this.value >= 0) {
      return this.variance as Scenario;
    } else {
      //flip the style
      if (Scenario.NEU === this.variance) {
        return Scenario.NEU;
      }
      if (Scenario.POS === this.variance) {
        return Scenario.NEG;
      } else {
        return Scenario.POS;
      }
    }
  }

  isClipped(): boolean {
    if (this.value == null){
      return false;
    }

    return Math.abs(this.value) > 1.45;
  }

  getClippedValue(): number {
    return 145;
  }

  getScenario() {
    return this.scenario?.slice(0, 2);
  }
}
