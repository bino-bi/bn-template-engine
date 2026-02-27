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
});
