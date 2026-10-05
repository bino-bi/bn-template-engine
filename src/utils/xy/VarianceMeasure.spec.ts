import {
  resolveMeasure,
  scenarioFamily,
  scenarioSlotNumber,
  VarianceMeasure,
  axisInValueUnits,
  isRelativeMeasure,
} from "./VarianceMeasure";

describe("VarianceMeasure", () => {
  describe("parse", () => {
    it("parses tokens with a sentiment suffix (existing grammar)", () => {
      const vm = VarianceMeasure.parse("dac1_pl1_pos");
      expect(vm).not.toBeNull();
      expect(vm!.type).toBe("d");
      expect(vm!.base).toBe("ac1");
      expect(vm!.delta).toBe("pl1");
    });

    it("parses tokens without a sentiment suffix (axis form, spec §4.4)", () => {
      const vm = VarianceMeasure.parse("drpp1_ac1");
      expect(vm).not.toBeNull();
      expect(vm!.type).toBe("dr");
      expect(vm!.base).toBe("pp1");
      expect(vm!.delta).toBe("ac1");
    });

    it("parses relative tokens with sentiment", () => {
      const vm = VarianceMeasure.parse("drac2_fc3_neu");
      expect(vm).not.toBeNull();
      expect(vm!.type).toBe("dr");
      expect(vm!.base).toBe("ac2");
      expect(vm!.delta).toBe("fc3");
    });

    it("rejects invalid sentiments", () => {
      expect(VarianceMeasure.parse("dac1_pl1_bad")).toBeNull();
    });

    it("rejects plain scenario tokens", () => {
      expect(VarianceMeasure.parse("ac1")).toBeNull();
    });

    it("is anchored: rejects tokens with surrounding noise", () => {
      expect(VarianceMeasure.parse("xdac1_pl1_pos")).toBeNull();
      expect(VarianceMeasure.parse("dac1_pl1_posx")).toBeNull();
    });

    it("rejects slot numbers outside 1-4", () => {
      expect(VarianceMeasure.parse("dac5_pl1")).toBeNull();
      expect(VarianceMeasure.parse("dac1_pl0")).toBeNull();
    });
  });

  describe("compute", () => {
    it("computes absolute variances as base - delta", () => {
      expect(VarianceMeasure.parse("dac1_pl1")!.compute(120, 100)).toBe(20);
      expect(VarianceMeasure.parse("dac1_pl1")!.compute(80, 100)).toBe(-20);
    });

    it("computes relative variances as (base - delta) / |delta|", () => {
      expect(VarianceMeasure.parse("drac1_pl1")!.compute(120, 100)).toBeCloseTo(0.2);
    });

    it("divides a relative variance by the absolute reference", () => {
      // (-50 + 100) / |-100| = 0.5
      expect(VarianceMeasure.parse("drac1_pl1")!.compute(-50, -100)).toBeCloseTo(0.5);
    });

    it("is null-safe on missing operands", () => {
      const vm = VarianceMeasure.parse("dac1_pl1")!;
      expect(vm.compute(null, 100)).toBeNull();
      expect(vm.compute(100, null)).toBeNull();
      expect(vm.compute(undefined, undefined)).toBeNull();
    });

    it("returns null instead of dividing by zero", () => {
      expect(VarianceMeasure.parse("drac1_pl1")!.compute(100, 0)).toBeNull();
      expect(VarianceMeasure.parse("drac1_pl1")!.compute(Number.NaN, 0)).toBeNull();
      // a reference that is 0 up to float rounding
      expect(VarianceMeasure.parse("drac1_pl1")!.compute(30, 1234.56 - 1000.1 - 234.46)).toBeNull();
    });
  });

  describe("resolveMeasure", () => {
    it("resolves plain scenario slots", () => {
      expect(resolveMeasure("ac3")).toEqual({ kind: "scenario", slot: "ac3" });
    });

    it("resolves variance tokens", () => {
      const ref = resolveMeasure("drpp1_ac1");
      expect(ref?.kind).toBe("variance");
    });

    it("returns null for unknown tokens", () => {
      expect(resolveMeasure("xx1")).toBeNull();
      expect(resolveMeasure("")).toBeNull();
    });
  });

  describe("slot helpers", () => {
    it("extracts family and slot number", () => {
      expect(scenarioFamily("ac1")).toBe("ac");
      expect(scenarioFamily("pl4")).toBe("pl");
      expect(scenarioSlotNumber("pp3")).toBe("3");
    });
  });
});

describe("relative variance axis", () => {
  it("knows a relative variance measure by its token", () => {
    expect(isRelativeMeasure("drac1_pp1")).toBe(true);
    expect(isRelativeMeasure(" drac1_pl1_pos ")).toBe(true);
    expect(isRelativeMeasure("dac1_pp1")).toBe(false);
    expect(isRelativeMeasure("ac1")).toBe(false);
  });

  it("reads min, max, refLine and highlight of a relative variance axis in percent", () => {
    const axis = axisInValueUnits({
      measure: "drac1_pp1",
      unit: "%",
      min: -40,
      max: 40,
      refLine: 20,
      highlight: { from: 10, to: 30 },
    });

    expect(axis.min).toBeCloseTo(-0.4);
    expect(axis.max).toBeCloseTo(0.4);
    expect(axis.refLine).toBeCloseTo(0.2);
    expect(axis.highlight!.from).toBeCloseTo(0.1);
    expect(axis.highlight!.to).toBeCloseTo(0.3);
    expect(axis.unit).toBe("%");
  });

  it("keeps what is not set", () => {
    const axis = axisInValueUnits({ measure: "drac1_pp1", highlight: { from: 10 } });

    expect(axis.min).toBeUndefined();
    expect(axis.refLine).toBeUndefined();
    expect(axis.highlight).toEqual({ from: 0.1, to: undefined });
  });

  it("leaves the axis of any other measure alone", () => {
    const axis = { measure: "dac1_pp1", min: -40, max: 40, refLine: 20 };

    expect(axisInValueUnits(axis)).toBe(axis);
  });
});
