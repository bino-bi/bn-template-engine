import { assignIds, resolveOwnIdentity, resolveStandaloneId } from "./identity";

const makeElement = (attrs: Record<string, string> = {}, tag = "bn-table"): HTMLElement => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
};

describe("resolveOwnIdentity", () => {
  it("prefers the id attribute", () => {
    expect(resolveOwnIdentity(makeElement({ id: "revenue", name: "other" }))).toBe("revenue");
  });

  it("falls back to the name attribute", () => {
    expect(resolveOwnIdentity(makeElement({ name: "revenue" }))).toBe("revenue");
  });

  it("returns undefined without id or name", () => {
    expect(resolveOwnIdentity(makeElement())).toBeUndefined();
  });
});

describe("resolveStandaloneId", () => {
  it("uses the explicit identity when present", () => {
    expect(resolveStandaloneId(makeElement({ id: "revenue" }))).toBe("revenue");
  });

  it("falls back to the tag name", () => {
    expect(resolveStandaloneId(makeElement({}, "bn-chart-time"))).toBe("bn-chart-time");
  });
});

describe("assignIds", () => {
  it("generates tag[index] per tag in document order", () => {
    expect(assignIds([{ tag: "bn-table" }, { tag: "bn-chart-time" }, { tag: "bn-table" }])).toEqual([
      "bn-table[0]",
      "bn-chart-time[0]",
      "bn-table[1]",
    ]);
  });

  it("keeps explicit ids and does not shift sibling indexes", () => {
    expect(assignIds([{ tag: "bn-table" }, { tag: "bn-table", explicitId: "revenue" }, { tag: "bn-table" }])).toEqual([
      "bn-table[0]",
      "revenue",
      "bn-table[2]",
    ]);
  });
});
