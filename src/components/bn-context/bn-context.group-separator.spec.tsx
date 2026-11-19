// bn-context sets the group separator of every number on the page.

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

import { installMutationObserverFake } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

import { newSpecPage, SpecPage } from "@stencil/core/testing";
import { getOrCreateStores } from "../../context/context-protocol";
import { Formatter } from "../../utils/formatter";
import { Context } from "./bn-context";

// The separator is one value for the page, and a spec page does not disconnect what the
// page before it left behind: every test takes its contexts off the page when it is done.
const pages: SpecPage[] = [];

const open = async (html: string): Promise<SpecPage> => {
  const page = await newSpecPage({ components: [Context], html });
  pages.push(page);
  return page;
};

const render = async (attributes: string) => {
  const page = await open(`<bn-context locale="en" ${attributes}></bn-context>`);
  return { page, context: page.root as HTMLElement };
};

describe("bn-context group separator", () => {
  afterEach(async () => {
    for (const page of pages.splice(0)) {
      page.body.querySelectorAll("bn-context").forEach((context) => context.remove());
      await page.waitForChanges();
    }
    Formatter.groupSeparator = null;
  });

  it("keeps the separator of the locale without the attribute", async () => {
    await render("");
    expect(Formatter.groupSeparator).toBeNull();
    expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "en")).toBe("1,234.5");
  });

  it("takes a named separator, none, and the separator itself", async () => {
    const { page, context } = await render('group-separator="thin-space"');
    expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "en")).toBe("1\u2009234.5");

    context.setAttribute("group-separator", "none");
    await page.waitForChanges();
    expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "en")).toBe("1234.5");

    context.setAttribute("group-separator", "'");
    await page.waitForChanges();
    expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "en")).toBe("1'234.5");
  });

  it("draws what follows the locale again when the separator changes", async () => {
    const { page, context } = await render('group-separator="thin-space"');
    const store = getOrCreateStores(context).context;
    const seen: string[] = [];
    store.on("set", (key, value) => {
      if (key === "locale") seen.push(value as string);
    });

    context.setAttribute("group-separator", "space");
    await page.waitForChanges();

    expect(Formatter.groupSeparator).toBe(" ");
    // the locale is set again, and ends where it was
    expect(seen).toEqual(["", "en"]);
    expect(store.state.locale).toBe("en");

    // the same value again draws nothing
    seen.length = 0;
    context.setAttribute("group-separator", "space");
    await page.waitForChanges();
    expect(seen).toEqual([]);
  });

  it("takes the separator back when the context that set it leaves the page", async () => {
    const { page, context } = await render('group-separator="thin-space"');
    context.remove();
    await page.waitForChanges();
    expect(Formatter.groupSeparator).toBeNull();
  });

  describe("with two contexts on a page", () => {
    const renderTwo = async (first: string, second: string) => {
      const page = await open(
        `<bn-context id="a" locale="en" ${first}></bn-context><bn-context id="b" locale="en" ${second}></bn-context>`,
      );
      const a = page.body.querySelector("#a") as HTMLElement;
      const b = page.body.querySelector("#b") as HTMLElement;
      return { page, a, b };
    };

    it("keeps the separator of one context when the other declares none", async () => {
      await renderTwo('group-separator="thin-space"', "");
      expect(Formatter.groupSeparator).toBe("\u2009");
    });

    it("lets the last context that declares one win, and falls back when it leaves", async () => {
      const { page, a, b } = await renderTwo('group-separator="thin-space"', 'group-separator="space"');
      expect(Formatter.groupSeparator).toBe("\u00a0");

      b.remove();
      await page.waitForChanges();
      expect(Formatter.groupSeparator).toBe("\u2009");

      a.remove();
      await page.waitForChanges();
      expect(Formatter.groupSeparator).toBeNull();
    });

    it("keeps the separator of the other context when one clears its own", async () => {
      const { page, b } = await renderTwo('group-separator="thin-space"', 'group-separator="space"');
      b.removeAttribute("group-separator");
      await page.waitForChanges();
      expect(Formatter.groupSeparator).toBe("\u2009");
    });

    it("draws the numbers of every context again when the separator changes", async () => {
      const { page, a, b } = await renderTwo('group-separator="thin-space"', "");
      const seen: string[] = [];
      for (const [name, element] of [
        ["a", a],
        ["b", b],
      ] as const) {
        getOrCreateStores(element).context.on("set", (key, value) => {
          if (key === "locale") seen.push(`${name}:${value}`);
        });
      }

      a.setAttribute("group-separator", "space");
      await page.waitForChanges();

      expect(Formatter.groupSeparator).toBe("\u00a0");
      expect(seen).toEqual(["a:", "a:en", "b:", "b:en"]);
    });
  });
});
