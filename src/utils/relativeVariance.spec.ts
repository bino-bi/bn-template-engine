import { NOT_AVAILABLE, relativeVariance } from "./relativeVariance";

describe("relativeVariance", () => {
  it("divides by the absolute reference", () => {
    expect(relativeVariance(20, 100)).toBeCloseTo(0.2);
    // -80 against -100 is better by 20
    expect(relativeVariance(20, -100)).toBeCloseTo(0.2);
    expect(relativeVariance(-20, -100)).toBeCloseTo(-0.2);
  });

  it("is undefined for a zero reference", () => {
    expect(relativeVariance(50, 0)).toBeUndefined();
    expect(relativeVariance(0, 0)).toBeUndefined();
  });

  it("treats a reference that is 0 up to float rounding as 0", () => {
    // the sum is -8.5e-14, not 0
    expect(relativeVariance(30, 1234.56 - 1000.1 - 234.46)).toBeUndefined();
    // a small reference with a real ratio stays: 30 / 1e-6 = 3e7
    expect(relativeVariance(30, 1e-6)).toBeCloseTo(3e7);
  });

  it("keeps missing data as NaN", () => {
    expect(relativeVariance(Number.NaN, 0)).toBeNaN();
    expect(relativeVariance(Number.NaN, 100)).toBeNaN();
    expect(relativeVariance(10, Number.NaN)).toBeNaN();
  });

  it("names the text for a zero reference", () => {
    expect(NOT_AVAILABLE).toBe("n/a");
  });
});
