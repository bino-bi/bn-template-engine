import { IBCSRuleSet, ruleSetLabels, styleSlot, stylesBySlot } from "./ibcsRuleSet";
import { SVGStyleAdapter } from "./model/styles/SVGStyle";
import { SVGStyleGroup, SVGStyleGroupAdapter } from "./model/styles/SVGStyleGroup";

describe("styleSlot", () => {
  it.each([
    [10, "ac"],
    [20, "pp"],
    [30, "fc"],
    [50, "pl"],
    [99, "ac"],
  ])("colorIndex %p selects the slot %p", (colorIndex, slot) => {
    expect(styleSlot(colorIndex)).toBe(slot);
  });
});

describe("stylesBySlot", () => {
  const group = (): SVGStyleGroup => new SVGStyleGroupAdapter(new SVGStyleAdapter()).adapt({});

  it("returns the same object for the built-in rule set", () => {
    const styles = group();

    expect(stylesBySlot(styles, new IBCSRuleSet())).toBe(styles);
  });

  it("returns the same object for a rule set that restates the built-in color indices", () => {
    const styles = group();
    const ruleSet = new IBCSRuleSet({ scenarios: { ac: { colorIndex: 10 }, pl: { colorIndex: 50 } } });

    expect(stylesBySlot(styles, ruleSet)).toBe(styles);
  });

  it("puts a scenario on the slot its colorIndex selects and leaves the input alone", () => {
    const styles = group();
    const moved = stylesBySlot(styles, new IBCSRuleSet({ scenarios: { pl: { colorIndex: 30 } } }));

    expect(moved).not.toBe(styles);
    expect(moved.pl).toBe(styles.fc);
    expect(moved.ac).toBe(styles.ac);
    expect(styles.pl).not.toBe(styles.fc);
  });

  it("keeps the methods of a style group", () => {
    const styles = group();
    const moved = stylesBySlot(styles, new IBCSRuleSet({ scenarios: { pl: { colorIndex: 30 } } }));

    expect(moved).toBeInstanceOf(SVGStyleGroup);
    expect(moved.getSVGStyle("pl")).toBe(styles.fc);
  });

  it("treats an unknown colorIndex as 10", () => {
    const styles = group();

    expect(stylesBySlot(styles, new IBCSRuleSet({ scenarios: { pp: { colorIndex: 99 } } })).pp).toBe(styles.ac);
  });
});

describe("ruleSetLabels", () => {
  it("is empty without a config or without names", () => {
    expect(ruleSetLabels(undefined).size).toBe(0);
    expect(ruleSetLabels({ scenarios: { ac: { sortIndex: 1 } } }).size).toBe(0);
  });

  it("names slot 1 as given and the slots 2 to 4 with their number", () => {
    const labels = ruleSetLabels({ scenarios: { pl: { name: "Budget" } } });

    expect([...labels.entries()]).toEqual([
      ["pl1", "Budget"],
      ["pl2", "Budget2"],
      ["pl3", "Budget3"],
      ["pl4", "Budget4"],
    ]);
  });

  it("ignores empty names and prefixes that have no data column", () => {
    const labels = ruleSetLabels({ scenarios: { ac: { name: "" }, bu: { name: "BU" }, dac: { name: "dAC" } } });

    expect(labels.size).toBe(0);
  });
});

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
