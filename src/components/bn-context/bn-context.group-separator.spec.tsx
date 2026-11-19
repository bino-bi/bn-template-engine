// bn-context sets the group separator of every number on the page.

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

import { installMutationObserverFake } from "../../utils/testing/mutationObserver";

installMutationObserverFake();

import { newSpecPage } from "@stencil/core/testing";
import { getOrCreateStores } from "../../context/context-protocol";
import { Formatter } from "../../utils/formatter";
import { Context } from "./bn-context";

const render = async (attributes: string) => {
  const page = await newSpecPage({
    components: [Context],
    html: `<bn-context locale="en" ${attributes}></bn-context>`,
  });
  return { page, context: page.root as HTMLElement };
};

describe("bn-context group separator", () => {
  afterEach(() => {
    Formatter.groupSeparator = null;
  });

  it("keeps the separator of the locale without the attribute", async () => {
    await render("");
    expect(Formatter.groupSeparator).toBeNull();
    expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "en")).toBe("1,234.5");
  });

  it("takes a named separator, none, and the separator itself", async () => {
    await render('group-separator="thin-space"');
    expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "en")).toBe("1 234.5");

    await render('group-separator="none"');
    expect(Formatter.number(1234.5, "decimal", 1, 1, 1, "en")).toBe("1234.5");

    await render(`group-separator="'"`);
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
});
