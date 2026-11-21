import { Formatter } from "./formatter";

describe("Formatter Test", () => {
  describe("Format number", () => {
    it("should return number with no decimal digits ", () => {
      expect(Formatter.number(100, "decimal", 2, 0, 1)).toEqual("100");
    });

    it("should return number with 2 decimal digits ", () => {
      expect(Formatter.number(100, "decimal", 2, 2, 1)).toEqual("100,00");
    });

    it("should return percent value with 1 decimal digits ", () => {
      expect(Formatter.number(1, "percent", 2, 1, 1)).toEqual("100,0%");
    });

    it("should return scaled number with 1 decimal digit ", () => {
      expect(Formatter.number(1, "decimal", 2, 1, 10)).toEqual("0,1");
    });
    it("should return scaled number with 1 decimal digit ", () => {
      expect(Formatter.number(-1, "decimal", 2, 1, 10)).toEqual("-0,1");
    });
  });

  describe("Format number per locale", () => {
    it("prints English separators for en", () => {
      expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "en")).toEqual("1,234.5");
    });

    it("prints an English percent for en", () => {
      expect(Formatter.number(0.052, "percent", 2, 2, 1, "en")).toEqual("5.20%");
    });

    it("keeps the German format for de", () => {
      expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "de")).toEqual("1.234,5");
      expect(Formatter.number(0.052, "percent", 2, 2, 1, "de")).toEqual("5,20%");
      expect(Formatter.number(1234.5, "decimal", 1, 1)).toEqual("1.234,5");
      expect(Formatter.number(0.052, "percent", 2, 2)).toEqual("5,20%");
    });

    it("prints no negative zero", () => {
      expect(Formatter.number(-0.04, "decimal", 1, 1)).toEqual("0,0");
      expect(Formatter.number(-0.00004, "percent", 2, 2)).toEqual("0,00%");
      expect(Formatter.number(-0.4, "decimal", 0, 0)).toEqual("0");
      // -0.06 rounds to -0.1, the sign stays
      expect(Formatter.number(-0.06, "decimal", 1, 1)).toEqual("-0,1");
    });

    it("falls back to German for an unknown or malformed locale", () => {
      expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "xx")).toEqual("1.234,5");
      expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "de_DE")).toEqual("1.234,5");
    });
  });

  describe("Format translateScenarioLabel", () => {
    const i18n: Map<string, string> = new Map();

    [
      { key: "ac1", value: "AC" },
      { key: "pp1", value: "PY" },
      { key: "fc1", value: "FC" },
      { key: "pl1", value: "PL" },
      { key: "ibcssymbol_delta_ac", value: "Δ{%}" },
      { key: "ibcssymbol_delta_generic", value: "Δ({%})" },
      { key: "ibcssymbol_delta_ac_relative", value: "Δ{%}%" },
      { key: "ibcssymbol_delta_generic_relative", value: "Δ({%})%" },
    ].forEach(function (entry) {
      i18n.set(entry.key, entry.value);
    });

    it("should return variance label ", () => {
      expect(Formatter.translateScenarioLabel("dac1_fc1_neg", i18n)).toEqual("ΔFC");
    });

    it("should return detailed variance label", () => {
      expect(Formatter.translateScenarioLabel("dfc1_ac1_neg", i18n)).toEqual("Δ(FC - AC)");
    });

    it("names the reference alone with {ref} and the minuend with {base}", () => {
      const short = new Map(i18n);
      short.set("ibcssymbol_delta_generic", "Δ{ref}");
      short.set("ibcssymbol_delta_generic_relative", "Δ{ref}% of {base}");
      expect(Formatter.translateScenarioLabel("dfc1_pp1_op", short)).toEqual("ΔPY");
      expect(Formatter.translateScenarioLabel("drpl1_pp1_op", short)).toEqual("ΔPY% of PL");
    });

    it("should return detailed relative variance labe;", () => {
      expect(Formatter.translateScenarioLabel("drfc1_ac1_neg", i18n)).toEqual("Δ(FC - AC)%");
    });

    it("should return scenario translated", () => {
      expect(Formatter.translateScenarioLabel("ac1", i18n)).toEqual("AC");
    });

    it("should return scenario not translated", () => {
      expect(Formatter.translateScenarioLabel("ac", i18n)).toEqual("ac");
    });

    it("should return detailed relative variance label not transladed;", () => {
      expect(Formatter.translateScenarioLabel("drac_fc_neg", i18n)).toEqual("drac_fc_neg");
    });

    it("should return relative variance label not transladed;", () => {
      expect(Formatter.translateScenarioLabel("drac1_fc_neg", i18n)).toEqual("drac1_fc_neg");
    });

    it("should return relative variance  partly  not transladed;", () => {
      expect(Formatter.translateScenarioLabel("drac1_fc5_neg", i18n)).toEqual("Δfc5%");
    });

    it("should return relative variance  partly  not transladed based on ac1", () => {
      expect(Formatter.translateScenarioLabel("drac1_fc5_neg", i18n)).toEqual("Δfc5%");
    });

    it("should return relative variance label not transladed;", () => {
      expect(Formatter.translateScenarioLabel("drac5_fc5_neg", i18n)).toEqual("Δ(ac5 - fc5)%");
    });

    it("should return label not transladed;", () => {
      expect(Formatter.translateScenarioLabel("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", i18n)).toEqual(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      );
    });

    it("should return relative variance label  transladed;", () => {
      expect(Formatter.translateScenarioLabel("dac1_pl1_pos", i18n)).toEqual("ΔPL");
    });
  });

  describe("Group separator of the document", () => {
    afterEach(() => {
      Formatter.groupSeparator = null;
    });

    it("keeps the separator of the locale when none is set", () => {
      expect(Formatter.number(1234567.5, "decimal", 1, 1, 1, "en")).toBe("1,234,567.5");
    });

    it("replaces the group separator and keeps the decimal sign", () => {
      Formatter.groupSeparator = "\u2009";
      expect(Formatter.number(1234567.5, "decimal", 1, 1, 1, "en")).toBe("1\u2009234\u2009567.5");
      expect(Formatter.number(1234567.5, "decimal", 1, 1, 1, "de")).toBe("1\u2009234\u2009567,5");
      expect(Formatter.number(-0.001, "decimal", 1, 1, 1, "en")).toBe("0.0");
    });

    it("prints no separator for the empty string", () => {
      Formatter.groupSeparator = "";
      expect(Formatter.number(1234567, "decimal", 0, 0, 1, "de")).toBe("1234567");
    });
  });
});
