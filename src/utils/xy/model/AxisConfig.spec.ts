import {
  parseSpec,
  toAxisConfig,
  toFacetConfig,
  toIsoConfig,
  toLabelConfig,
  toLegendConfig,
  toShareConfig,
  toSizeConfig,
} from "./AxisConfig";

describe("parseSpec", () => {
  it("treats blank input as absent, not as an error", () => {
    expect(parseSpec("", "measure")).toEqual({ data: null, parseError: false });
    expect(parseSpec(undefined, "measure")).toEqual({ data: null, parseError: false });
    expect(parseSpec("  ", "measure")).toEqual({ data: null, parseError: false });
  });

  it("expands a bare string to the shorthand object", () => {
    expect(parseSpec("ac1", "measure")).toEqual({ data: { measure: "ac1" }, parseError: false });
  });

  it("parses JSON objects", () => {
    const { data, parseError } = parseSpec('{"measure":"ac1","label":"Margin"}', "measure");
    expect(parseError).toBe(false);
    expect(data).toEqual({ measure: "ac1", label: "Margin" });
  });

  it("flags malformed JSON as a parse error", () => {
    expect(parseSpec('{"measure":', "measure").parseError).toBe(true);
  });

  it("flags non-object JSON as a parse error", () => {
    expect(parseSpec("[1,2]", "measure").parseError).toBe(true);
  });

  it("flags bare strings as errors when no shorthand key is allowed", () => {
    expect(parseSpec("auto", null).parseError).toBe(true);
  });
});

describe("toAxisConfig", () => {
  it("extracts all known fields", () => {
    const { config, unknownKeys, invalidFields } = toAxisConfig({
      measure: "ac1",
      label: "Margin",
      unit: "%",
      min: 0,
      max: 40,
      refLine: 0.5,
      highlight: { from: 30 },
    });
    expect(invalidFields).toEqual([]);
    expect(unknownKeys).toEqual([]);
    expect(config).toEqual({
      measure: "ac1",
      label: "Margin",
      unit: "%",
      min: 0,
      max: 40,
      refLine: 0.5,
      highlight: { from: 30 },
    });
  });

  it("requires a measure", () => {
    const { config, invalidFields } = toAxisConfig({ label: "Margin" });
    expect(config).toBeNull();
    expect(invalidFields).toContain("measure");
  });

  it("collects unknown sub-fields for the forward-compat warning", () => {
    const { config, unknownKeys } = toAxisConfig({ measure: "ac1", futureThing: 1 });
    expect(config).not.toBeNull();
    expect(unknownKeys).toEqual(["futureThing"]);
  });

  it("reports fields with unusable types", () => {
    const { config, invalidFields } = toAxisConfig({ measure: "ac1", min: "zero" });
    expect(config).not.toBeNull();
    expect(config!.min).toBeUndefined();
    expect(invalidFields).toContain("min");
  });
});

describe("toSizeConfig / toShareConfig", () => {
  it("extracts size fields including the scaling group", () => {
    const { config } = toSizeConfig({ measure: "ac3", label: "Net sales", unit: "mEUR", group: "netsales-area" });
    expect(config).toEqual({ measure: "ac3", label: "Net sales", unit: "mEUR", group: "netsales-area" });
  });

  it("share accepts only a measure", () => {
    const { config, unknownKeys } = toShareConfig({ measure: "ac4", label: "x" });
    expect(config).toEqual({ measure: "ac4" });
    expect(unknownKeys).toEqual(["label"]);
  });
});

describe("toAxisConfig titlePosition", () => {
  it("reads the place of the title and rejects an unknown one", () => {
    expect(toAxisConfig({ measure: "ac1", titlePosition: "beside" }).config!.titlePosition).toBe("beside");
    const { config, invalidFields } = toAxisConfig({ measure: "ac1", titlePosition: "left" });
    expect(config!.titlePosition).toBeUndefined();
    expect(invalidFields).toContain("titlePosition");
  });
});

describe("toAxisConfig step", () => {
  it("reads a positive step and rejects any other", () => {
    expect(toAxisConfig({ measure: "ac1", step: 10 }).config!.step).toBe(10);
    const { config, invalidFields } = toAxisConfig({ measure: "ac1", step: -1 });
    expect(config!.step).toBeUndefined();
    expect(invalidFields).toContain("step");
  });
});

describe("toIsoConfig", () => {
  it("accepts 'auto' and numeric arrays", () => {
    expect(toIsoConfig({ values: "auto" }).config).toEqual({ values: "auto", label: undefined, unit: undefined });
    expect(toIsoConfig({ values: [1, 2, 3] }).config!.values).toEqual([1, 2, 3]);
  });

  it("rejects other value shapes", () => {
    const { config, invalidFields } = toIsoConfig({ values: "1,2" });
    expect(config).toBeNull();
    expect(invalidFields).toContain("values");
  });

  it("reads a positive factor and rejects any other", () => {
    expect(toIsoConfig({ values: [1], factor: 0.001 }).config!.factor).toBe(0.001);
    const { config, invalidFields } = toIsoConfig({ values: [1], factor: 0 });
    expect(config!.factor).toBeUndefined();
    expect(invalidFields).toContain("factor");
  });

  it("extracts the highlight-from threshold", () => {
    expect(toIsoConfig({ values: "auto", highlight: { from: 3 } }).config!.highlight).toEqual({ from: 3 });
  });
});

describe("toLabelConfig", () => {
  const defaults = { points: "auto" as const, values: true, max: 12 };

  it("applies defaults for missing fields", () => {
    expect(toLabelConfig({}, defaults).config).toEqual({ points: "auto", values: true, max: 12 });
  });

  it("accepts keyword and explicit-list points", () => {
    expect(toLabelConfig({ points: "none" }, defaults).config!.points).toBe("none");
    expect(toLabelConfig({ points: ["VAB", "RS6"] }, defaults).config!.points).toEqual(["VAB", "RS6"]);
  });

  it("reads the side of a list entry and keeps its name in the list", () => {
    const { config, invalidFields } = toLabelConfig(
      { points: ["VAB", { name: "RS6", side: "nw" }, { name: "X" }] },
      defaults,
    );
    expect(invalidFields).toEqual([]);
    expect(config!.points).toEqual(["VAB", "RS6", "X"]);
    expect(config!.sides).toEqual({ RS6: "nw" });
  });

  it("has no side for a point that is named like a property of an object", () => {
    const { config } = toLabelConfig({ points: ["constructor", { name: "RS6", side: "n" }] }, defaults);
    expect(config!.sides!["constructor"]).toBeUndefined();
  });

  it("rejects a list with an unknown side", () => {
    const { config, invalidFields } = toLabelConfig({ points: [{ name: "RS6", side: "up" }] }, defaults);
    expect(invalidFields).toContain("points");
    expect(config!.points).toBe("auto");
  });

  it("rejects invalid points values but keeps the rest", () => {
    const { config, invalidFields } = toLabelConfig({ points: 5, max: 3 }, defaults);
    expect(invalidFields).toContain("points");
    expect(config!.points).toBe("auto");
    expect(config!.max).toBe(3);
  });

  it("requires a positive max", () => {
    expect(toLabelConfig({ max: -1 }, defaults).invalidFields).toContain("max");
  });
});

describe("toFacetConfig", () => {
  it("normalizes the level casing", () => {
    expect(toFacetConfig({ level: "RowGroup" }).config).toEqual({ level: "rowgroup" });
  });

  it("rejects unknown levels", () => {
    expect(toFacetConfig({ level: "subcategory" }).config).toBeNull();
  });

  it("floors and validates columns", () => {
    expect(toFacetConfig({ level: "category", columns: 6.7 }).config!.columns).toBe(6);
    expect(toFacetConfig({ level: "category", columns: 0 }).invalidFields).toContain("columns");
  });
});

describe("toLegendConfig", () => {
  it("defaults to a visible right-hand legend", () => {
    expect(toLegendConfig({}).config).toEqual({ show: true, position: "right" });
  });

  it("accepts show/position and rejects unknown positions", () => {
    expect(toLegendConfig({ show: false, position: "bottom" }).config).toEqual({ show: false, position: "bottom" });
    expect(toLegendConfig({ position: "top" }).invalidFields).toContain("position");
  });
});

describe("toLegendConfig align", () => {
  it("reads the alignment and rejects an unknown one", () => {
    expect(toLegendConfig({ align: "center" }).config!.align).toBe("center");
    const { config, invalidFields } = toLegendConfig({ align: "middle" });
    expect(config!.align).toBeUndefined();
    expect(invalidFields).toContain("align");
  });
});
