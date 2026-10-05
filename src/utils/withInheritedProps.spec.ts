import {
  findLayoutAncestors,
  isInheritedValue,
  readInherited,
  INHERITED_CLOSEST,
  INHERITED_PAGE,
} from "./withInheritedProps";

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

  describe("ancestor lookup", () => {
    /** Builds `tags[0] > tags[1] > ... > div` and returns every element, outermost first. */
    const nest = (...tags: string[]): HTMLElement[] => {
      const elements = [...tags, "div"].map((tag) => document.createElement(tag));
      elements.forEach((element, idx) => (elements[idx - 1] ?? document.body).appendChild(element));
      return elements;
    };

    const resolve = (leaf: HTMLElement, mode: string, attr = "title-scenarios") =>
      readInherited(findLayoutAncestors(leaf, mode), attr);

    // Identity per element: deep equality does not work on mock-doc nodes.
    const expectAncestors = (leaf: HTMLElement, mode: string, expected: HTMLElement[]) => {
      const ancestors = findLayoutAncestors(leaf, mode);
      expect(ancestors).toHaveLength(expected.length);
      ancestors.forEach((ancestor, idx) => expect(ancestor).toBe(expected[idx]));
    };

    it("lists every card up to the page for 'inherited-closest', nearest first", () => {
      const [page, outer, inner, leaf] = nest("bn-layout-page", "bn-layout-card", "bn-layout-card");

      expectAncestors(leaf, INHERITED_CLOSEST, [inner, outer, page]);
    });

    it("lists the page only for 'inherited-page'", () => {
      const [page, , , leaf] = nest("bn-layout-page", "bn-layout-card", "bn-layout-card");

      expectAncestors(leaf, INHERITED_PAGE, [page]);
    });

    it("stops at the first page", () => {
      const [, page, card, leaf] = nest("bn-layout-card", "bn-layout-page", "bn-layout-card");

      expectAncestors(leaf, INHERITED_CLOSEST, [card, page]);
    });

    it("finds nothing without a layout ancestor", () => {
      const [, leaf] = nest("section");

      expectAncestors(leaf, INHERITED_CLOSEST, []);
      expectAncestors(leaf, INHERITED_PAGE, []);
      expect(resolve(leaf, INHERITED_CLOSEST)).toBeUndefined();
    });

    it("crosses a shadow boundary", () => {
      const [, card] = nest("bn-layout-page", "bn-layout-card");
      const leaf = document.createElement("div");
      card.attachShadow({ mode: "open" }).appendChild(leaf);

      // Tag names: mock-doc's `shadowRoot.host` is not identical to the host element.
      expect(findLayoutAncestors(leaf, INHERITED_CLOSEST).map((ancestor) => ancestor.nodeName)).toEqual([
        "BN-LAYOUT-CARD",
        "BN-LAYOUT-PAGE",
      ]);
    });

    it("skips a card that does not set the attribute", () => {
      const [page, , leaf] = nest("bn-layout-page", "bn-layout-card");
      page.setAttribute("title-scenarios", "ac1,pp1");

      expect(resolve(leaf, INHERITED_CLOSEST)).toBe("ac1,pp1");
    });

    it("takes the card when it sets the attribute", () => {
      const [page, card, leaf] = nest("bn-layout-page", "bn-layout-card");
      page.setAttribute("title-scenarios", "ac1,pp1");
      card.setAttribute("title-scenarios", "ac1");

      expect(resolve(leaf, INHERITED_CLOSEST)).toBe("ac1");
    });

    it("takes the outer card when the inner one does not set the attribute", () => {
      const [page, outer, , leaf] = nest("bn-layout-page", "bn-layout-card", "bn-layout-card");
      page.setAttribute("title-scenarios", "ac1,pp1");
      outer.setAttribute("title-scenarios", "fc1");

      expect(resolve(leaf, INHERITED_CLOSEST)).toBe("fc1");
    });

    it("ignores the cards for 'inherited-page'", () => {
      const [page, card, leaf] = nest("bn-layout-page", "bn-layout-card");
      page.setAttribute("title-scenarios", "ac1,pp1");
      card.setAttribute("title-scenarios", "ac1");

      expect(resolve(leaf, INHERITED_PAGE)).toBe("ac1,pp1");
    });

    it.each([INHERITED_PAGE, INHERITED_CLOSEST])("never hands a card's literal '%s' to a child", (keyword) => {
      const [page, card, leaf] = nest("bn-layout-page", "bn-layout-card");
      card.setAttribute("title-scenarios", keyword);

      expect(resolve(leaf, INHERITED_CLOSEST)).toBeUndefined();

      page.setAttribute("title-scenarios", "ac1,pp1");
      expect(resolve(leaf, INHERITED_CLOSEST)).toBe("ac1,pp1");
    });

    it.each(["", "  ", "null"])("treats the blank attribute value '%s' as not set", (blank) => {
      const [page, card, leaf] = nest("bn-layout-page", "bn-layout-card");
      page.setAttribute("title-scenarios", "ac1,pp1");
      card.setAttribute("title-scenarios", blank);

      expect(resolve(leaf, INHERITED_CLOSEST)).toBe("ac1,pp1");
    });

    it("takes the page value behind a card that follows the page, not the value of an outer card", () => {
      const [page, outerCard, innerCard, leaf] = nest("bn-layout-page", "bn-layout-card", "bn-layout-card");
      page.setAttribute("title-scenarios", "ac1,pp1");
      outerCard.setAttribute("title-scenarios", "ac1");
      innerCard.setAttribute("title-scenarios", INHERITED_PAGE);

      // the inner card shows the page value, so what is inside it must get the same
      expect(resolve(leaf, INHERITED_CLOSEST)).toBe("ac1,pp1");
    });

    it("finds nothing behind a card that follows a page without the value", () => {
      const [, outerCard, innerCard, leaf] = nest("bn-layout-page", "bn-layout-card", "bn-layout-card");
      outerCard.setAttribute("title-scenarios", "ac1");
      innerCard.setAttribute("title-scenarios", INHERITED_PAGE);

      expect(resolve(leaf, INHERITED_CLOSEST)).toBeUndefined();
    });

    it("goes on to the next card behind a card with 'inherited-closest'", () => {
      const [page, outerCard, innerCard, leaf] = nest("bn-layout-page", "bn-layout-card", "bn-layout-card");
      page.setAttribute("title-scenarios", "ac1,pp1");
      outerCard.setAttribute("title-scenarios", "ac1");
      innerCard.setAttribute("title-scenarios", INHERITED_CLOSEST);

      expect(resolve(leaf, INHERITED_CLOSEST)).toBe("ac1");
    });

    it("reads each attribute on its own", () => {
      const [page, card, leaf] = nest("bn-layout-page", "bn-layout-card");
      page.setAttribute("ruleset", "page-rules");
      card.setAttribute("title-scenarios", "ac1");

      expect(resolve(leaf, INHERITED_CLOSEST, "ruleset")).toBe("page-rules");
      expect(resolve(leaf, INHERITED_CLOSEST, "title-scenarios")).toBe("ac1");
    });
  });
});
