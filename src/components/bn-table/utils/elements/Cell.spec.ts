import { DataFormatDigits } from "../../../../components";
import { Cell } from "./Cell";
// import {DataFormatDigits} from "../../../../utils/model/DataFormatDigits";

describe("Cell Class Test", () => {
  it("should return empty", async () => {
    const cell = new Cell("ac1", 0, 100, null, null, null, null, null, null);
    expect(cell.drawPrefix()).toEqual("");
  });

  it("should return empty", async () => {
    const cell = new Cell("ac1", 0, 100, null, "decimal", null, null, null, 10);
    const dataFormatDigits: DataFormatDigits = { percent: 3, decimal: 3 };

    expect(cell.draw(dataFormatDigits)).toEqual("10,000");
  });

  it("draws a percentpoint cell as the number times 100 with the percent digits", async () => {
    // the measure scale 1000 must not be applied: -0.021 * 100 = -2.10
    const cell = new Cell("dac1_pp1_pos", 0, -0.021, null, "percentpoint", null, null, null, 1000);
    const dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

    expect(cell.draw(dataFormatDigits)).toEqual("-2,10");
    expect(cell.draw(dataFormatDigits, "en")).toEqual("-2.10");
  });

  it("rounds a percentpoint cell like the percent cell next to it", async () => {
    // 0.00035 is 0,04% in the percent cell, but 0.00035 * 100 is 0.034999999999999996
    const cell = new Cell("dac1_pp1_pos", 0, 0.00035, null, "percentpoint", null, null, null, null);
    const dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

    expect(cell.draw(dataFormatDigits)).toEqual("0,04");
    expect(new Cell("ac1", 0, 0.00035, null, "percent", null, null, null, null).draw(dataFormatDigits)).toEqual(
      "0,04%",
    );
  });

  it("leaves no percent sign in a percentpoint cell where the locale writes it differently", async () => {
    const cell = new Cell("dac1_pp1_pos", 0, -0.021, null, "percentpoint", null, null, null, null);
    const dataFormatDigits: DataFormatDigits = { percent: 2, decimal: 1 };

    // tr writes -%2,10, eu writes \u2212% 2,10, fa writes \u066a after Persian digits
    expect(cell.draw(dataFormatDigits, "tr")).toEqual("-2,10");
    expect(cell.draw(dataFormatDigits, "eu")).toEqual("\u22122,10");
    expect(cell.draw(dataFormatDigits, "fa")).not.toMatch(/[%\u066a]/);
  });

  describe("roundsToZero", () => {
    const digits: DataFormatDigits = { percent: 1, decimal: 1 };
    const cell = (value: number | string | null, type: string | null, measureScale: number | null = null) =>
      new Cell("dac1_pp1_pos", 0, value, null, type, null, null, null, measureScale);

    it("is true for a decimal value that prints as zero", async () => {
      for (const value of [0, 0.04, -0.04]) {
        expect(cell(value, "decimal").roundsToZero(digits)).toBe(true);
      }
      expect(cell(0.06, "decimal").roundsToZero(digits)).toBe(false);
      expect(cell(-0.06, "decimal").roundsToZero(digits)).toBe(false);
    });

    it("is true for a percent or percentpoint value that prints as zero", async () => {
      for (const type of ["percent", "percentpoint"]) {
        for (const value of [0, 0.0004, -0.0004]) {
          expect(cell(value, type).roundsToZero(digits, "en")).toBe(true);
        }
        expect(cell(0.0006, type).roundsToZero(digits, "en")).toBe(false);
        expect(cell(-0.0006, type).roundsToZero(digits, "en")).toBe(false);
      }
    });

    it("follows the digits and the measure scale", async () => {
      expect(cell(0.04, "decimal").roundsToZero({ percent: 1, decimal: 2 })).toBe(false);
      expect(cell(40, "decimal", 1000).roundsToZero(digits)).toBe(true);
      expect(cell(60, "decimal", 1000).roundsToZero(digits)).toBe(false);
    });

    it("is false for a cell that prints no number", async () => {
      expect(cell(null, "decimal").roundsToZero(digits)).toBe(false);
      expect(cell("n/a", "percent").roundsToZero(digits)).toBe(false);
      expect(cell("-", "decimal").roundsToZero(digits)).toBe(false);
      expect(cell(0, null).roundsToZero(digits)).toBe(false);
    });
  });
});
