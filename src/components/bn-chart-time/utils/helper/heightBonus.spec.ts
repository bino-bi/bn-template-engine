import { measureHeightBonus, settleHeightBonus } from "./heightBonus";

describe("height bonus of the base segment", () => {
  it("is what the variance segments leave of their shares", () => {
    expect(measureHeightBonus(100, [40, 70])).toBe(90);
  });

  it("subtracts what a segment takes beyond its share", () => {
    expect(measureHeightBonus(100, [40, 140])).toBe(20);
    expect(measureHeightBonus(100, [90, 140])).toBe(0);
  });

  it("gives a segment that is not drawn its share", () => {
    expect(measureHeightBonus(100, [0, 40])).toBe(60);
    expect(measureHeightBonus(100, [])).toBe(0);
  });

  it("always applies a smaller bonus, and a larger one only when it is not jitter", () => {
    expect(settleHeightBonus(60, 55)).toBe(55);
    expect(settleHeightBonus(60, 59.5)).toBe(60);
    expect(settleHeightBonus(60, 66)).toBe(60);
    expect(settleHeightBonus(60, 80)).toBe(80);
  });
});
