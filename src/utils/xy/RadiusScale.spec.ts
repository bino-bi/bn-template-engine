import { RadiusScale } from "./RadiusScale";

describe("RadiusScale", () => {
  describe("local mode", () => {
    it("is area-true: 4x value gives 2x radius", () => {
      const scale = RadiusScale.local(100, 40, 2);
      expect(scale.radius(100)).toBeCloseTo(40);
      expect(scale.radius(25)).toBeCloseTo(20);
      expect(scale.radius(25) * 2).toBeCloseTo(scale.radius(100));
    });

    it("clamps small values to the minimum visible radius", () => {
      const scale = RadiusScale.local(100, 40, 2);
      expect(scale.radius(0.001)).toBe(2);
      expect(scale.radius(0)).toBe(2);
    });

    it("caps at rMax for the maximum value", () => {
      const scale = RadiusScale.local(100, 40, 2);
      expect(scale.radius(100)).toBeLessThanOrEqual(40);
    });

    it("degrades gracefully when vMax is zero", () => {
      const scale = RadiusScale.local(0, 40, 2);
      expect(scale.radius(5)).toBe(2);
    });
  });

  describe("grouped mode (bn-scaling-group)", () => {
    it("interprets the group value as area px² per data unit", () => {
      const areaPerUnit = 12;
      const scale = RadiusScale.grouped(areaPerUnit);
      const value = 30;
      expect(scale.radius(value)).toBeCloseTo(Math.sqrt((areaPerUnit * value) / Math.PI));
    });

    it("is area-true: 4x value gives 2x radius", () => {
      const scale = RadiusScale.grouped(7);
      expect(scale.radius(4) / scale.radius(1)).toBeCloseTo(2);
    });

    it("renders identical values at identical radii across instances", () => {
      const chartA = RadiusScale.grouped(12);
      const chartB = RadiusScale.grouped(12);
      expect(chartA.radius(32)).toBe(chartB.radius(32));
    });

    it("applies no min/max caps (true-size, may overflow the panel)", () => {
      const scale = RadiusScale.grouped(1000);
      expect(scale.radius(10000)).toBeGreaterThan(1000);
      expect(scale.radius(0.000001)).toBeLessThan(0.1);
      expect(scale.radius(0)).toBe(0);
    });
  });
});
