import { buildFromExpr, hasInlineJs } from "./scopedDb";

describe("hasInlineJs", () => {
  it.each([
    ["category = 'Sales'", false],
    ["category = '`'", false],
    ["", false],
    [null, false],
    ["x = ``alert(1)``", true],
    ["x = `/**/`alert(1)`/**/`", true],
  ])("%p -> %p", (sql, expected) => {
    expect(hasInlineJs(sql)).toBe(expected);
  });
});

describe("buildFromExpr", () => {
  it("names the table when there is no filter", () => {
    expect(buildFromExpr("t")).toBe("`t`");
  });

  it("wraps a filter in a subquery", () => {
    expect(buildFromExpr("t", "a = 1")).toBe("(SELECT * FROM `t` WHERE a = 1) AS __src");
  });

  it("selects nothing for a filter with inline JavaScript", () => {
    expect(buildFromExpr("t", "a = ``alert(1)``")).toBe("(SELECT * FROM `t` WHERE 1 = 0) AS __src");
  });
});
