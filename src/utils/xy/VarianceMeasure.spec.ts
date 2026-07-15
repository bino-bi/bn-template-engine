import { resolveMeasure, scenarioFamily, scenarioSlotNumber, VarianceMeasure } from "./VarianceMeasure";

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

    it("computes relative variances as (base - delta) / delta", () => {
      expect(VarianceMeasure.parse("drac1_pl1")!.compute(120, 100)).toBeCloseTo(0.2);
    });

    it("is null-safe on missing operands", () => {
      const vm = VarianceMeasure.parse("dac1_pl1")!;
      expect(vm.compute(null, 100)).toBeNull();
      expect(vm.compute(100, null)).toBeNull();
      expect(vm.compute(undefined, undefined)).toBeNull();
    });

    it("returns null instead of dividing by zero", () => {
      expect(VarianceMeasure.parse("drac1_pl1")!.compute(100, 0)).toBeNull();
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
