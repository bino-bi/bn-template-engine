import { parseRanges, toBulletLabelConfig, toBulletMeasureConfig } from "./BulletConfig";

describe("toBulletMeasureConfig", () => {
  it("extracts all known fields", () => {
    const { config, unknownKeys, invalidFields } = toBulletMeasureConfig({
      measure: "pl1",
      label: "Plan",
      unit: "EUR k",
    });
    expect(invalidFields).toEqual([]);
    expect(unknownKeys).toEqual([]);
    expect(config).toEqual({ measure: "pl1", label: "Plan", unit: "EUR k" });
  });

  it("requires a measure", () => {
    const { config, invalidFields } = toBulletMeasureConfig({ label: "Plan" });
    expect(config).toBeNull();
    expect(invalidFields).toContain("measure");
  });

  it("collects unknown sub-fields for the forward-compat warning", () => {
    const { config, unknownKeys } = toBulletMeasureConfig({ measure: "ac1", futureThing: 1 });
    expect(config).not.toBeNull();
    expect(unknownKeys).toEqual(["futureThing"]);
  });

  it("reports fields with unusable types", () => {
    const { config, invalidFields } = toBulletMeasureConfig({ measure: "ac1", label: 7 });
    expect(config).not.toBeNull();
    expect(invalidFields).toEqual(["label"]);
  });
});

describe("toBulletLabelConfig", () => {
  const defaults = { show: "auto" as const, decimals: 1 };

  it("falls back to the defaults for absent fields", () => {
    const { config } = toBulletLabelConfig({}, defaults);
    expect(config).toEqual({ show: "auto", decimals: 1 });
  });

  it("accepts show and decimals", () => {
    const { config, invalidFields } = toBulletLabelConfig({ show: "none", decimals: 0 }, defaults);
    expect(invalidFields).toEqual([]);
    expect(config).toEqual({ show: "none", decimals: 0 });
  });

  it("floors fractional decimals", () => {
    const { config } = toBulletLabelConfig({ decimals: 2.7 }, defaults);
    expect(config?.decimals).toBe(2);
  });

  it("rejects out-of-range decimals and unknown show values", () => {
    const { config, invalidFields } = toBulletLabelConfig({ show: "all", decimals: 9 }, defaults);
    expect(invalidFields).toEqual(expect.arrayContaining(["show", "decimals"]));
    expect(config).toEqual({ show: "auto", decimals: 1 });
  });

  it("collects unknown sub-fields", () => {
    const { unknownKeys } = toBulletLabelConfig({ futureThing: true }, defaults);
    expect(unknownKeys).toEqual(["futureThing"]);
  });
});

describe("parseRanges", () => {
  it("treats blank input as absent, not as an error", () => {
    expect(parseRanges("")).toEqual({ ranges: [], parseError: false, issues: [] });
    expect(parseRanges(undefined)).toEqual({ ranges: [], parseError: false, issues: [] });
    expect(parseRanges("  ")).toEqual({ ranges: [], parseError: false, issues: [] });
  });

  it("parses an ascending pair", () => {
    expect(parseRanges("[0.6, 0.9]")).toEqual({ ranges: [0.6, 0.9], parseError: false, issues: [] });
  });

  it("accepts a single entry", () => {
    expect(parseRanges("[0.75]")).toEqual({ ranges: [0.75], parseError: false, issues: [] });
  });

  it("sorts unsorted input and reports it", () => {
    const result = parseRanges("[0.9, 0.6]");
    expect(result.parseError).toBe(false);
    expect(result.ranges).toEqual([0.6, 0.9]);
    expect(result.issues).toHaveLength(1);
  });

  it("truncates to two entries and reports it", () => {
    const result = parseRanges("[0.5, 0.7, 0.9]");
    expect(result.parseError).toBe(false);
    expect(result.ranges).toEqual([0.5, 0.7]);
    expect(result.issues).toHaveLength(1);
  });

  it("flags malformed JSON as a parse error", () => {
    expect(parseRanges("[0.6").parseError).toBe(true);
  });

  it("flags non-array JSON as a parse error", () => {
    expect(parseRanges('{"to":0.6}').parseError).toBe(true);
    expect(parseRanges("0.6").parseError).toBe(true);
  });

  it("flags empty arrays as a parse error", () => {
    expect(parseRanges("[]").parseError).toBe(true);
  });

  it("flags non-positive and non-numeric entries as a parse error", () => {
    expect(parseRanges("[0.6, -0.9]").parseError).toBe(true);
    expect(parseRanges("[0]").parseError).toBe(true);
    expect(parseRanges('["0.6"]').parseError).toBe(true);
  });
});
