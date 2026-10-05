import { normalizeFillPattern, SVGStyleAdapter } from "./SVGStyle";

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
