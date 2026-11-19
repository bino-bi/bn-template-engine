// jest.mock must physically precede the imports - Stencil's jest transform does not hoist it.
const labelValues: unknown[] = [];

// Records the value handed to the Label, so no svg text has to be measured.
jest.mock("./Label", () => ({
  HookLocation: jest.requireActual("./Label").HookLocation,
  Label: class {
    constructor(...args: unknown[]) {
      labelValues.push(args[4]);
    }
    setEmphasis() {
      return this;
    }
    setSegmentFill() {
      return this;
    }
    setPoint() {
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
import { StackedBar, StackedBarOptions } from "./StackedBar";
import { ElementPositions } from "../helper";
import { DataPoint, ScaleFactorsStructureChartAdapter, StructureChartStyle } from "../model";
import { StructureChartStylesAdapter } from "../model/styles/StructureChartStyle";
import { StackMode } from "../../../../utils/constants";
import { layoutStack, StackLayout } from "../../../../utils/stackLayout";
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
  getBarWidthAt: () => 20,
  getLabelPositionX: (scaled: number) => 100 + scaled,
} as unknown as ElementPositions;

// The stack of the segment: the rest up to `total` is a second segment.
const stackOf = (value: number, total: number): StackLayout => layoutStack([value, total - value]);

const segmentLabel = (
  locale: string,
  value: number,
  total: number,
  mode: StackMode = StackMode.ABSOLUTE_RELATIVE,
  options: StackedBarOptions = {},
): unknown => {
  labelValues.length = 0;
  // 1 pixel per unit, so the segment of 45 is longer than the 6 pixel padding of a label
  const dataPoint = new DataPoint(value, "ac1", 1, null);
  const stack = stackOf(value, total);
  const bar = new StackedBar(
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
    options,
  );
  bar.draw({ percent: 1, decimal: 1 });
  bar.drawTotalLabel({ percent: 1, decimal: 1 });

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

  it("prints a negative share for a negative segment", () => {
    // -20 in a stack of 100 and -20: the share base is the sum of absolute values, 120
    expect(segmentLabel("en", -20, 80)).toBe("-16.7%");
  });
});

describe("StackedBar labels of a 100 % stack", () => {
  it("prints the share with a percent sign and no total", () => {
    expect(segmentLabel("en", 45, 100, StackMode.RELATIVE)).toBe("45.0%");
    expect(labelValues).toHaveLength(1);
  });

  it("prints the share as a plain number", () => {
    expect(segmentLabel("en", 45, 100, StackMode.RELATIVE, { label: "plain-share" })).toBe("45.0");
  });

  it("prints the value of the segment and the total of the bar", () => {
    expect(segmentLabel("en", 45, 100, StackMode.RELATIVE, { label: "value", total: true })).toBe(45);
    // the second label is the total
    expect(labelValues).toEqual([45, 100]);
  });

  it("keeps the label of an absolute stack", () => {
    expect(segmentLabel("en", 45, 100, StackMode.ABSOLUTE, { label: "value" })).toBe(45);
  });
});
