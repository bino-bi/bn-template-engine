// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
const labelValues: unknown[] = [];

// Records the value handed to the Label, so no svg text has to be measured.
jest.mock("./Label", () => ({
  HookLocation: jest.requireActual("./Label").HookLocation,
  Label: class {
    constructor(...args: unknown[]) {
      labelValues.push(args[4]);
    }
    setSegmentFill() {
      return this;
    }
    setPoint() {
      return this;
    }
    forceStringTypeDraw() {
      return this;
    }
    draw() {
      return this;
    }
  },
}));

import { G } from "@svgdotjs/svg.js";
import { StackedColumn } from "./StackedColumn";
import { ElementPositions } from "../helper";
import { DataPoint } from "../model";
import { TimeChartStyle, TimeChartStylesAdapter } from "../model/styles/TimeChartStyle";
import { ScaleFactorsTimeChartAdapter } from "../model/styles/ScaleFactorsTimeChart";
import { StackMode } from "../../../../utils/constants";
import { layoutStack, StackLayout } from "../../../../utils/stackLayout";
import { FontStyleAdapter } from "../../../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../../../utils/model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../../../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../../../utils/model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../../../../utils/model/styles/Padding";

const buildStyles = (locale: string): TimeChartStyle => {
  const styles = new TimeChartStylesAdapter(
    new ScaleFactorsTimeChartAdapter(),
    new FontStyleAdapter(),
    new SVGStyleGroupAdapter(new SVGStyleAdapter()),
    new SVGVariancesStyleGroupAdapter(new SVGStyleAdapter()),
    new PaddingAdapter(),
  ).adapt({});
  styles.locale = locale;

  return styles;
};

// Stands in for the svg.js group: every call and every property call returns the group again.
const svgGroup = (): G => {
  const group: any = new Proxy(function () {}, {
    get: () => () => group,
    apply: () => group,
  });

  return group;
};

const position = {
  getColumnPositionY: () => 200,
  getColumnCenterPositionX: () => 50,
  getColumnWidth: () => 20,
} as unknown as ElementPositions;

// The stack of the segment: the rest up to `total` is a second segment.
const stackOf = (value: number, total: number): StackLayout => layoutStack([value, total - value]);

const segmentLabel = (locale: string, mode: StackMode, value: number, total: number): unknown => {
  labelValues.length = 0;
  // 1 pixel per unit, so the segment of 45 is higher than the 18 pixel a label needs
  const dataPoint = new DataPoint(value, "ac1", 1, null);
  const stack = stackOf(value, total);
  new StackedColumn(
    position,
    buildStyles(locale),
    dataPoint,
    0,
    stack.segments[0],
    "ac1",
    0,
    mode,
    stack,
    false,
    svgGroup(),
  ).draw({
    percent: 1,
    decimal: 1,
  });

  return labelValues[0];
};

describe("StackedColumn share label", () => {
  it("prints the share of a segment with a decimal point when the locale is en", () => {
    // 45 / 100 = 45.0%
    expect(segmentLabel("en", StackMode.RELATIVE, 45, 100)).toBe("45.0%");
  });

  it("prints the share of a segment with a decimal comma when the locale is de", () => {
    expect(segmentLabel("de", StackMode.RELATIVE, 45, 100)).toBe("45,0%");
  });

  it("prints a negative share for a negative segment", () => {
    // -20 in a stack of 100 and -20: the share base is the sum of absolute values, 120
    expect(segmentLabel("en", StackMode.ABSOLUTE_RELATIVE, -20, 80)).toBe("-16.7%");
  });
});
