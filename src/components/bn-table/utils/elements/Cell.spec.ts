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
});
