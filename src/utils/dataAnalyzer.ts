import alasql from "alasql";
import { SiPrefix } from "./model/SiPrefix";

/*
yotta	Y
zetta	Z
exa	E
peta	P
tera	T
giga	G
mega	M
kilo	k
hecto	h
deca	da

deci	d
centi	c
milli	m
micro	μ
nano	n
pico	p
femto	f
atto	a
zepto	z
yocto	y
    */

export enum NumeralFigure {
  "Y" = 1e24,
  "Z" = 1e21,
  "E" = 1e18,
  "P" = 1e15,
  "T" = 1e12,
  "G" = 1000000000,
  "M" = 1000000,
  "k" = 1000,
  "h" = 100,
  "da" = 10,
  "d" = 0.1,
  "c" = 0.01,
  "m" = 0.001,
  "my" = 0.000001,
  "n" = 0.000000001,
  "p" = 0.000000000001,
  "f" = 0.000000000000001,
  "a" = 0.000000000000000001,
  "z" = 0.000000000000000000001,
  "y" = 0.000000000000000000000001,
}

export class DataAnalyzer {
  private static unitsGreat = ["k", "M", "G", "T", "P", "E", "Z", "Y"];
  private static unitsLeast = ["m", "my", "n", "p", "P", "f", "a", "z", "y"];

  static calculateMeasureScale(data: Record<string, unknown>[], scenarios: string[], mode: string | null): SiPrefix {
    if (mode === "_") {
      return new SiPrefix();
    }

    if (mode != null) {
      if ([...this.unitsLeast, ...this.unitsGreat].includes(mode)) {
        return this.lookupPrefix(mode);
      }
    }

    if (scenarios.length == 0) {
      return new SiPrefix();
    }

    // filtering wordlenght == 3, so variances are not considered
    const queryMax = `SELECT MAX(GREATEST(${scenarios
      .filter((word) => word.length == 3)
      .map((x) => "ABS(" + x + ")")
      .toString()})) as prefixvalue
                      FROM ?`;
    const queryMin = `SELECT MIN(LEAST(${scenarios
      .filter((word) => word.length == 3)
      .map((x) => "ABS(" + x + ")")
      .toString()})) as prefixvalue
                      FROM ?`;

    let query = queryMax;

    if (mode?.toUpperCase() === "LEAST") {
      query = queryMin;
    }

    const result = alasql(query, [data]);
    const num = result[0]?.prefixvalue;

    return this.determinePrefix(Math.abs(num));
  }

  private static determinePrefix(num: number): SiPrefix {
    if (num >= 1000) {
      const floor = Math.floor(Math.floor(Math.abs(num)).toString().length / 3);
      const value = +Math.pow(1000, floor);

      return new SiPrefix(this.unitsGreat[floor - 1], value);
    }

    if (num <= 0.001) {
      const floor = Math.floor(Math.abs(num).toString().length / 3);
      const value = +(1 / Math.pow(1000, floor));

      return new SiPrefix(this.unitsLeast[floor - 1], value);
    }

    return new SiPrefix();
  }

  private static lookupPrefix(mode: string): SiPrefix {
    return new SiPrefix(mode, NumeralFigure[mode as keyof typeof NumeralFigure]);
  }
}
