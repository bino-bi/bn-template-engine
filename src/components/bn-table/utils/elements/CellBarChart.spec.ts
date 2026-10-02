import { formatValue } from "./CellBarChart";

describe("formatValue", () => {
  it("prints the decimal separator of the locale", () => {
    expect(formatValue(1234.5, false, 1, "de")).toBe("+1,2K");
    expect(formatValue(9.5, false, 1, "de")).toBe("+9,5");
    expect(formatValue(2500000, false, 1, "en")).toBe("+2.5M");
  });

  it("keeps the short form and its 0 or 1 digit", () => {
    expect(formatValue(12345, false, 1, "de")).toBe("+12K");
    expect(formatValue(-950, false, 1, "de")).toBe("-950");
    expect(formatValue(1000, false, 1, "de")).toBe("+1K");
  });

  it("applies the measure scale before the short form", () => {
    // 1234500 / 1000 = 1234.5
    expect(formatValue(1234500, false, 1000, "de")).toBe("+1,2K");
  });

  it("prints a relative value with the given percent digits", () => {
    expect(formatValue(0.125, true, 1, "de", 1)).toBe("+12,5%");
    expect(formatValue(0.125, true, 1, "en", 2)).toBe("+12.50%");
  });

  it("prints a relative value as a whole percent without percent digits", () => {
    expect(formatValue(0.125, true)).toBe("+13%");
  });

  it("prints no negative zero", () => {
    expect(formatValue(-0.04, false, 1, "de")).toBe("0");
  });

  it("moves a value that rounds to 1000 to the next unit", () => {
    expect(formatValue(999.4, false, 1, "de")).toBe("+999");
    // not +1.000 and +1.000K
    expect(formatValue(999.6, false, 1, "de")).toBe("+1K");
    expect(formatValue(999600, false, 1, "de")).toBe("+1M");
    expect(formatValue(-999600000, false, 1, "de")).toBe("-1B");
  });

  it("drops digits of a relative label that is longer than the label gutter", () => {
    expect(formatValue(0.125, true, 1, "de", 2)).toBe("+12,50%");
    // not +123,46%, -100,00% and +1.234,56%
    expect(formatValue(1.2346, true, 1, "de", 2)).toBe("+123,5%");
    expect(formatValue(-1, true, 1, "de", 2)).toBe("-100,0%");
    expect(formatValue(12.3456, true, 1, "de", 2)).toBe("+1.235%");
  });

  it("prints a relative value when the percent digits are out of range", () => {
    expect(formatValue(0.6, true, 1, "en", -1)).toBe("+60%");
    expect(formatValue(0.6, true, 1, "en", 101)).toBe("+60.00%");
  });
});
