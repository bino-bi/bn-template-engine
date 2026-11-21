import { normalizeFillPattern, SVGStyleAdapter, styleForValue } from "./SVGStyle";

describe("SVGStyleAdapter fillpattern", () => {
  const adapter = new SVGStyleAdapter();
  const base = { stroke: "#404040", fill: "#ffffff", width: 0.5 };

  it("reads the old value fc as hatched", () => {
    expect(adapter.adapt({ ...base, fillpattern: "fc" }).fillpattern).toBe("hatched");
  });

  it("keeps hatched", () => {
    expect(adapter.adapt({ ...base, fillpattern: "hatched" }).fillpattern).toBe("hatched");
  });

  it("keeps solid and the fill of the style", () => {
    const style = adapter.adapt({ ...base, fillpattern: "solid" });

    expect(style.fillpattern).toBe("solid");
    expect(style.fill).toBe("#ffffff");
  });

  it("gives an outlined style a transparent fill", () => {
    const style = adapter.adapt({ ...base, fillpattern: "outlined" });

    expect(style.fillpattern).toBe("outlined");
    expect(style.fill).toBe("transparent");
    expect(style.stroke).toBe("#404040");
  });

  it("treats an unknown value as not set", () => {
    const style = adapter.adapt({ ...base, fillpattern: "dotted" });

    expect(style.fillpattern).toBeUndefined();
    expect(style.fill).toBe("#ffffff");
  });

  it("leaves a style without fillpattern unset", () => {
    expect(adapter.adapt(base).fillpattern).toBeUndefined();
  });

  it("uses hatched for the default FC style", () => {
    expect(adapter.defaultFC().fillpattern).toBe("hatched");
  });
});

describe("normalizeFillPattern", () => {
  it.each([
    ["fc", "hatched"],
    ["hatched", "hatched"],
    ["solid", "solid"],
    ["outlined", "outlined"],
    ["x", undefined],
    [undefined, undefined],
    [42, undefined],
  ])("maps %p to %p", (value, expected) => {
    expect(normalizeFillPattern(value)).toBe(expected);
  });
});

describe("styleForValue", () => {
  const style = new SVGStyleAdapter().adapt({ stroke: "#404040", fill: "#404040", width: 1, negativeFill: "#808080" });

  it("keeps the style for a value of 0 or more", () => {
    expect(styleForValue(style, 5)).toBe(style);
    expect(styleForValue(style, 0)).toBe(style);
    expect(styleForValue(style, null)).toBe(style);
  });

  it("takes the negative fill below 0, also for a stroke in the colour of the fill", () => {
    expect(styleForValue(style, -5)).toMatchObject({ fill: "#808080", stroke: "#808080", width: 1 });
  });

  it("keeps a stroke of its own", () => {
    const outlined = new SVGStyleAdapter().adapt({ stroke: "#000000", fill: "#ffffff", negativeFill: "#eeeeee" });
    expect(styleForValue(outlined, -1)).toMatchObject({ fill: "#eeeeee", stroke: "#000000" });
  });

  it("changes nothing without a negative fill", () => {
    const plain = new SVGStyleAdapter().adapt({ stroke: "#404040", fill: "#404040" });
    expect(styleForValue(plain, -5)).toBe(plain);
    expect(new SVGStyleAdapter().adapt({ negativeFill: "" }).negativeFill).toBeUndefined();
  });
});
