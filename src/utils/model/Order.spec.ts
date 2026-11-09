import { StringAdapter } from "../helper/StringAdapter";
import { normalizeOrderToken, OrderAdapter, OrderColumn, parseOrderToken } from "./Order";

describe("parseOrderToken", () => {
  it("parses dimensions to their column name", () => {
    expect(parseOrderToken("rowgroupindex")).toEqual({ kind: "dim", column: OrderColumn.ROWGROUPINDEX });
    expect(parseOrderToken(" SubCategory ")).toEqual({ kind: "dim", column: OrderColumn.SUBCATEGORY });
  });

  it("parses scenarios and variances, the sentiment is optional", () => {
    expect(parseOrderToken("AC1")).toEqual({ kind: "scenario", column: "ac1", bucket: undefined });
    expect(parseOrderToken("drac1_pl1_opinv")).toEqual({
      kind: "variance",
      column: "drac1_pl1",
      type: "dr",
      base: "ac1",
      delta: "pl1",
      bucket: undefined,
    });
    expect(parseOrderToken("dfc1_pp1")?.column).toEqual("dfc1_pp1");
  });

  it("keeps the bucket after @ as written, trimmed", () => {
    expect(parseOrderToken("dac1_pp1_pos@ _November ")?.bucket).toEqual("_November");
    expect(parseOrderToken("ac1@Nov")?.bucket).toEqual("Nov");
  });

  it("rejects invalid tokens", () => {
    for (const token of ["", "42", "auto", "dac1_pp1_xx", "dac5_pp1", "ac1@", "category@Nov", "dac1"]) {
      expect(parseOrderToken(token)).toBeUndefined();
    }
  });
});

describe("normalizeOrderToken", () => {
  it("drops the sentiment and keeps the bucket case", () => {
    expect(normalizeOrderToken("DAC1_PP1_POS@_November")).toEqual("dac1_pp1@_November");
    expect(normalizeOrderToken("categoryindex")).toEqual("categoryIndex");
    expect(normalizeOrderToken("foo")).toBeUndefined();
  });
});

describe("OrderAdapter", () => {
  const adapt = (adapter: OrderAdapter, hierarchy: string[]) =>
    adapter.adapt({ hierarchy, direction: "desc" }).hierarchy;

  it("maps variance and bucket tokens to category by default (charts, title)", () => {
    expect(adapt(new OrderAdapter(new StringAdapter()), ["dac1_pp1", "ac1@Nov", "ac1"])).toEqual([
      "category",
      "category",
      "ac1",
    ]);
  });

  it("keeps them for the table", () => {
    expect(adapt(new OrderAdapter(new StringAdapter(), true), ["dac1_pp1", "ac1@Nov", "rowgroup", "x"])).toEqual([
      "dac1_pp1",
      "ac1@Nov",
      "rowGroup",
      "category",
    ]);
  });
});
