import { MockDocument } from "@stencil/core/mock-doc";
import { dataPointAttributes, levelKey, pointDate, readLayoutPoint } from "./dataPoint";

describe("dataPointAttributes", () => {
  it("writes only the known fields", () => {
    expect(dataPointAttributes({ date: "2024-01-01", scenario: "ac1", category: undefined }, "element")).toEqual({
      "data-bn-date": "2024-01-01",
      "data-bn-scenario": "ac1",
      "data-bn-part": "element",
    });
  });

  it("leaves out empty values and the part when there is none", () => {
    expect(dataPointAttributes({ rowGroup: "", subCategory: "x", row: "subtotal" })).toEqual({
      "data-bn-sub-category": "x",
      "data-bn-row": "subtotal",
    });
  });

  it("gives nothing without a key", () => {
    expect(dataPointAttributes(undefined, "element")).toEqual({});
  });
});

describe("readLayoutPoint", () => {
  const element = (attributes: Record<string, string>): Element => {
    const el = new MockDocument().createElement("g");
    Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value));
    return el as unknown as Element;
  };

  it("reads back what was written", () => {
    const key = { rowGroup: "A", category: "B", subCategory: "C", date: "2024-01-01", scenario: "dac1_pl1_pos" };
    expect(readLayoutPoint(element(dataPointAttributes(key, "label")))).toEqual({ ...key, part: "label" });
  });

  it("has no point for an element without a part", () => {
    expect(readLayoutPoint(element(dataPointAttributes({ category: "B" })))).toBeUndefined();
  });
});

describe("pointDate", () => {
  it("gives the day of a bucket, and the time only when it is not midnight", () => {
    expect(pointDate("2024-01-01T00:00:00.000Z")).toBe("2024-01-01");
    expect(pointDate("2024-01-01T09:00:00.000Z")).toBe("2024-01-01T09:00:00");
    expect(pointDate(undefined)).toBeUndefined();
  });
});

describe("levelKey", () => {
  it("names the dimension of a level", () => {
    expect(levelKey("rowGroup", "A")).toEqual({ rowGroup: "A" });
    expect(levelKey("category", "A")).toEqual({ category: "A" });
    expect(levelKey("categoryIndex", "A")).toEqual({ category: "A" });
    expect(levelKey("subCategoryIndex", "A")).toEqual({ subCategory: "A" });
    expect(levelKey("category", null)).toEqual({});
  });
});
