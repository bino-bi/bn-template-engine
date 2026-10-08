// jest.mock must physically precede the imports (Stencil's transform does
// not hoist it).

(global as any).MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const mockStores = { componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }) };
  return { getStores: () => mockStores, clearStoresCache: () => {} };
});

import { newSpecPage } from "@stencil/core/testing";
import { Page } from "./bn-page";
import { pageGeometry, VALID_FORMATS } from "./pageFormats";

const render = (attrs: string) => newSpecPage({ components: [Page], html: `<bn-page ${attrs}></bn-page>` });
const ids = (host: Element): string[] =>
  (JSON.parse(host.getAttribute("has-error") ?? "[]") as { id: string }[]).map((e) => e.id);

describe("bn-page size", () => {
  it.each(VALID_FORMATS.flatMap((format) => [undefined, "landscape", "portrait"].map((o) => [format, o])))(
    "sets the size of %s (orientation %s) on the host",
    async (format, orientation) => {
      const page = await render(`format="${format}"` + (orientation ? ` orientation="${orientation}"` : ""));
      const expected = pageGeometry(format, orientation);

      expect(page.root.style.width).toBe(expected.width);
      expect(page.root.style.height).toBe(expected.height);
      expect(ids(page.root)).toEqual([]);
    },
  );

  it("draws Full HD as 1920 x 1080", async () => {
    const page = await render(`format="full-hd"`);

    expect(page.root.style.width).toBe("1920px");
    expect(page.root.style.height).toBe("1080px");
  });

  it("follows a later change of format and orientation", async () => {
    const page = await render(`format="a4"`);

    page.root.setAttribute("format", "a3");
    page.root.setAttribute("orientation", "landscape");
    await page.waitForChanges();

    expect(page.root.style.width).toBe("16.54in");
    expect(page.root.style.height).toBe("11.69in");
  });

  it("leaves the default size of the stylesheet for a page without format", async () => {
    const page = await render(`orientation="portrait"`);

    expect(page.root.style.width).toBe("");
    expect(page.root.style.height).toBe("");
    expect(ids(page.root)).toEqual([]);
  });
});

describe("bn-page validation", () => {
  it("warns about an unknown format that is there from the start", async () => {
    const page = await render(`format="full_hd"`);

    expect(ids(page.root)).toEqual(["WARN_format"]);
    expect(page.root.style.width).toBe("");
  });

  it("warns about an unknown orientation that is there from the start", async () => {
    const page = await render(`format="a4" orientation="sideways"`);

    expect(ids(page.root)).toEqual(["WARN_orientation"]);
  });

  it("removes the warning when the format is corrected", async () => {
    const page = await render(`format="a44"`);

    page.root.setAttribute("format", "a4");
    await page.waitForChanges();

    expect(ids(page.root)).toEqual([]);
  });
});
