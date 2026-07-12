import { IBCSRuleSet } from "./ibcsRuleSet";

describe("IBCSRuleSet", () => {
  describe("default construction (no config)", () => {
    const ruleSet = new IBCSRuleSet();

    it("keeps the built-in sort indices", () => {
      expect(ruleSet.getScenarioSorIndex("ac1")).toBe(410);
      expect(ruleSet.getScenarioSorIndex("pl1")).toBe(210);
      expect(ruleSet.getScenarioSorIndex("pp3")).toBe(130);
      expect(ruleSet.getScenarioSorIndex("dpl2")).toBe(1220);
      expect(ruleSet.getScenarioSorIndex("drac4")).toBe(2440);
    });

    it("keeps the built-in color indices and groups", () => {
      expect(ruleSet.getScenarioColorIndex("ac1")).toBe(10);
      expect(ruleSet.getScenarioColorIndex("fc2")).toBe(30);
      expect(ruleSet.getScenario("pl1")).toEqual({ name: "PL1", group: "PL", colorIndex: 50, sortIndex: 210 });
    });

    it("returns the fallback for unknown scenarios", () => {
      expect(ruleSet.getScenarioSorIndex("unknown")).toBe(120);
      expect(ruleSet.getScenario("unknown")).toEqual({
        name: "Series",
        group: "Series",
        colorIndex: 10,
        sortIndex: 120,
      });
    });

    it("normalizes variance column names for sort lookup", () => {
      expect(ruleSet.getScenarioSorIndex("dac1_pl1_pos")).toBe(1210);
      expect(ruleSet.getScenarioSorIndex("drac1_pp1_neg")).toBe(2110);
    });
  });

  describe("partial config overrides", () => {
    it("overrides a single sortIndex while keeping all other defaults", () => {
      const ruleSet = new IBCSRuleSet({ scenarios: { pl: { sortIndex: 900 } } });

      expect(ruleSet.getScenarioSorIndex("pl1")).toBe(910);
      expect(ruleSet.getScenario("pl1").name).toBe("PL1");
      expect(ruleSet.getScenario("pl1").colorIndex).toBe(50);
      expect(ruleSet.getScenarioSorIndex("ac1")).toBe(410);
      expect(ruleSet.getScenarioSorIndex("pp1")).toBe(110);
    });

    it("overrides the fallback", () => {
      const ruleSet = new IBCSRuleSet({ fallback: { sortIndex: 990 } });

      expect(ruleSet.getScenarioSorIndex("unknown")).toBe(990);
      expect(ruleSet.getScenario("unknown").name).toBe("Series");
    });

    it("supports user-defined scenario prefixes", () => {
      const ruleSet = new IBCSRuleSet({ scenarios: { xx: { name: "XX", colorIndex: 20, sortIndex: 500 } } });

      expect(ruleSet.getScenario("xx2")).toEqual({ name: "XX2", group: "XX", colorIndex: 20, sortIndex: 520 });
      expect(ruleSet.getScenarioSorIndex("ac1")).toBe(410);
    });
  });
});
