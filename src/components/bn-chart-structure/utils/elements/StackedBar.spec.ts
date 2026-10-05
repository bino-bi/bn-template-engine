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
    setMaxWidth() {
      return this;
    }
    draw() {
      return this;
    }
  },
}));

import { G } from "@svgdotjs/svg.js";
import { StackedBar } from "./StackedBar";
import { ElementPositions } from "../helper";
import { DataPoint, ScaleFactorsStructureChartAdapter, StructureChartStyle } from "../model";
import { StructureChartStylesAdapter } from "../model/styles/StructureChartStyle";
import { StackMode } from "../../../../utils/constants";
import { FontStyleAdapter } from "../../../../utils/model/styles/FontStyle";
import { SVGStyleGroupAdapter } from "../../../../utils/model/styles/SVGStyleGroup";
import { SVGStyleAdapter } from "../../../../utils/model/styles/SVGStyle";
import { SVGVariancesStyleGroupAdapter } from "../../../../utils/model/styles/SVGVariancesStyleGroup";
import { PaddingAdapter } from "../../../../utils/model/styles/Padding";

const buildStyles = (locale: string): StructureChartStyle => {
  const styles = new StructureChartStylesAdapter(
    new ScaleFactorsStructureChartAdapter(),
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
  getBarPositionX: () => 100,
  getBarPositionY: () => 50,
  getBarWidth: () => 20,
} as unknown as ElementPositions;

const segmentLabel = (locale: string, value: number, total: number): unknown => {
  labelValues.length = 0;
  // 1 pixel per unit, so the segment of 45 is longer than the 6 pixel padding of a label
  const dataPoint = new DataPoint(value, "ac1", 1, null);
  new StackedBar(
    position,
    buildStyles(locale),
    dataPoint,
    0,
    0,
    "ac1",
    0,
    StackMode.ABSOLUTE_RELATIVE,
    total,
    false,
    svgGroup(),
  ).draw({ percent: 1, decimal: 1 });

  return labelValues[0];
};

describe("StackedBar share label", () => {
  it("prints the share of a segment with a decimal point when the locale is en", () => {
    // 45 / 100 = 45.0%
    expect(segmentLabel("en", 45, 100)).toBe("45.0%");
  });

  it("prints the share of a segment with a decimal comma when the locale is de", () => {
    expect(segmentLabel("de", 45, 100)).toBe("45,0%");
  });

  it("prints a share of zero when the total of the stack is zero", () => {
    expect(segmentLabel("en", 45, 0)).toBe("0.0%");
  });
});
