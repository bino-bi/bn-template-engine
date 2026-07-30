import { formatScalingValue, parseScalingValue, resolveScalingValue } from "./scaling";

describe("parseScalingValue", () => {
  describe("auto", () => {
    it.each(["auto", "AUTO", "Auto", " auto ", "\tauto\n"])("parses %j as auto", (raw) => {
      expect(parseScalingValue(raw)).toEqual({ kind: "auto" });
    });
  });

  describe("plain numbers", () => {
    it.each([
      ["250000", 250000],
      ["1", 1],
      ["0.5", 0.5],
      [".5", 0.5],
      ["2.5", 2.5],
      [" 42 ", 42],
    ])("parses %j as %p", (raw, expected) => {
      expect(parseScalingValue(raw)).toEqual({ kind: "number", value: expected });
    });

    it("accepts positive numeric input directly", () => {
      expect(parseScalingValue(100)).toEqual({ kind: "number", value: 100 });
      expect(parseScalingValue(0.01)).toEqual({ kind: "number", value: 0.01 });
    });

    it("rejects non-positive and non-finite numeric input", () => {
      expect(parseScalingValue(0).kind).toBe("invalid");
      expect(parseScalingValue(-5).kind).toBe("invalid");
      expect(parseScalingValue(NaN).kind).toBe("invalid");
      expect(parseScalingValue(Infinity).kind).toBe("invalid");
    });
  });

  describe("SI suffixes", () => {
    it.each([
      ["1k", 1e3],
      ["1K", 1e3],
      ["1 k", 1e3],
      ["2.5M", 2.5e6],
      ["1M", 1e6],
      ["3G", 3e9],
      ["1T", 1e12],
      ["0.5M", 5e5],
      ["250k", 250000],
    ])("parses %j as %p", (raw, expected) => {
      expect(parseScalingValue(raw)).toEqual({ kind: "number", value: expected });
    });

    it("rejects lowercase m (SI milli ambiguity trap), g and t", () => {
      expect(parseScalingValue("1m").kind).toBe("invalid");
      expect(parseScalingValue("1g").kind).toBe("invalid");
      expect(parseScalingValue("1t").kind).toBe("invalid");
    });
  });

  describe("invalid values", () => {
    it.each([
      "",
      " ",
      null,
      undefined,
      "0",
      "0k",
      "-5",
      "-1M",
      "+5",
      "1e3",
      "1E3",
      "M",
      "k",
      "1MM",
      "5.",
      "1.2.3",
      "banana",
      "revenue-scale",
      "10%",
      "1,5",
    ])("rejects %j", (raw) => {
      expect(parseScalingValue(raw as string | null | undefined).kind).toBe("invalid");
    });

    it("keeps the trimmed raw string for messages", () => {
      expect(parseScalingValue(" banana ")).toEqual({ kind: "invalid", raw: "banana" });
    });
  });
});

describe("resolveScalingValue", () => {
  const groups = new Map<string, number>([
    ["revenue", 250000],
    ["1M", 7],
    ["auto", 99],
  ]);

  it("resolves a registered group name", () => {
    expect(resolveScalingValue("revenue", groups)).toEqual({ kind: "value", value: 250000 });
  });

  it("trims the group name before lookup", () => {
    expect(resolveScalingValue(" revenue ", groups)).toEqual({ kind: "value", value: 250000 });
  });

  it("lets auto win over a group literally named auto", () => {
    expect(resolveScalingValue("auto", groups)).toEqual({ kind: "auto" });
  });

  it("prefers a group entry over the numeric interpretation", () => {
    expect(resolveScalingValue("1M", groups)).toEqual({ kind: "value", value: 7 });
  });

  it("falls back to the numeric interpretation without a matching group", () => {
    expect(resolveScalingValue("1M", new Map())).toEqual({ kind: "value", value: 1e6 });
    expect(resolveScalingValue("100", new Map())).toEqual({ kind: "value", value: 100 });
    expect(resolveScalingValue(100, new Map())).toEqual({ kind: "value", value: 100 });
  });

  it("returns invalid for unknown names", () => {
    expect(resolveScalingValue("nope", groups)).toEqual({ kind: "invalid", raw: "nope" });
  });

  it("returns invalid for blank input", () => {
    expect(resolveScalingValue("", groups).kind).toBe("invalid");
    expect(resolveScalingValue(undefined, groups).kind).toBe("invalid");
  });
});

describe("formatScalingValue", () => {
  it.each([
    [1e6, "1M"],
    [250000, "250k"],
    [1234567, "1.23M"],
    [1e12, "1T"],
    [2.5e9, "2.5G"],
    [999, "999"],
    [100, "100"],
    [0.25, "0.25"],
    [0.0444, "0.0444"],
    [13333.3, "13.3k"],
  ])("formats %p as %j", (value, expected) => {
    expect(formatScalingValue(value)).toBe(expected);
  });

  it("passes through non-positive values unformatted", () => {
    expect(formatScalingValue(0)).toBe("0");
    expect(formatScalingValue(-1)).toBe("-1");
  });
});
