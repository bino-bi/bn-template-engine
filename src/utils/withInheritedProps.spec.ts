import { isInheritedValue, INHERITED_CLOSEST, INHERITED_PAGE } from "./withInheritedProps";

describe("withInheritedProps", () => {
  describe("isInheritedValue", () => {
    it("recognises 'inherited-closest'", () => {
      expect(isInheritedValue(INHERITED_CLOSEST)).toBe(true);
    });

    it("recognises 'inherited-page'", () => {
      expect(isInheritedValue(INHERITED_PAGE)).toBe(true);
    });

    it("rejects regular scenario values", () => {
      expect(isInheritedValue("ac1,fc1")).toBe(false);
      expect(isInheritedValue("auto")).toBe(false);
      expect(isInheritedValue("")).toBe(false);
    });

    it("rejects null/undefined cast to string", () => {
      expect(isInheritedValue(undefined as unknown as string)).toBe(false);
      expect(isInheritedValue(null as unknown as string)).toBe(false);
    });
  });
});
