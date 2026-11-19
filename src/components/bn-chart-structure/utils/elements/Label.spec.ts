import { G } from "@svgdotjs/svg.js";
import { HookLocation, Label } from "./Label";
import { StructureChartStyle } from "../model";
import { fakeGroup } from "../../../../utils/testing/fakeGroup";

const styles = { locale: "en", fontStyles: {} } as unknown as StructureChartStyle;
const digits = { percent: 1, decimal: 1 };

const drawn = (value: number, prepare: (label: Label) => Label): unknown => {
  const parent = fakeGroup();
  prepare(new Label(parent.node as G, 0, 0, "test", value, styles, HookLocation.Top, HookLocation.Center)).draw(digits);
  return parent.groups[0].calls.find(([name]) => name === "text")?.[1][0];
};

const absolute = (value: number) => drawn(value, (label) => label.setToVarianceLabel());
const relative = (value: number) => drawn(value, (label) => label.setToRelativeVarianceLabel());

describe("structure chart variance label sign", () => {
  it("prints a value that rounds to zero without a sign", () => {
    expect(absolute(0)).toBe("0.0");
    expect(absolute(0.04)).toBe("0.0");
    expect(absolute(-0.04)).toBe("0.0");
    expect(relative(0)).toBe("0.0%");
    expect(relative(0.0004)).toBe("0.0%");
    expect(relative(-0.0004)).toBe("0.0%");
  });

  it("keeps the sign of a value that does not round to zero", () => {
    expect(absolute(0.06)).toBe("+0.1");
    expect(absolute(-0.06)).toBe("-0.1");
    expect(relative(0.0006)).toBe("+0.1%");
    expect(relative(-0.0006)).toBe("-0.1%");
  });

  it("prints no sign on a label that is not a variance", () => {
    expect(drawn(12.34, (label) => label)).toBe("12.3");
  });
});

describe("structure chart value suffix", () => {
  const withSuffix = { locale: "en", fontStyles: {}, valueSuffix: "%" } as unknown as StructureChartStyle;
  const text = (prepare: (label: Label) => Label): unknown => {
    const parent = fakeGroup();
    prepare(new Label(parent.node as G, 0, 0, "test", 12.34, withSuffix, HookLocation.Top, HookLocation.Center)).draw(
      digits,
    );
    return parent.groups[0].calls.find(([name]) => name === "text")?.[1][0];
  };

  it("stands after a value, and not after a variance", () => {
    expect(text((label) => label)).toBe("12.3%");
    expect(text((label) => label.setToVarianceLabel())).toBe("+12.3");
  });
});
