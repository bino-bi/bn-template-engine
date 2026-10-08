// bn-context numbers its pages and writes the paper size of the document.
//
// The pages are plain elements here: the context only reads and writes
// their attributes.

// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

// mock-doc has no MutationObserver. The fake lets a spec report a change of
// the page list to the context.
import {
  installMutationObserverFake,
  notifyAttributeChange,
  notifyChildListChange,
} from "../../utils/testing/mutationObserver";

installMutationObserverFake();

import { newSpecPage } from "@stencil/core/testing";
import { Context } from "./bn-context";

const render = (html: string) => newSpecPage({ components: [Context], html });
const numbers = (root: Element): (string | null)[] =>
  Array.from(root.querySelectorAll("bn-layout-page, bn-footer")).map((el) => el.getAttribute("page-number"));
const pageSizeRules = (): string[] =>
  Array.from(document.head.querySelectorAll("style[data-bn-page-size]")).map((style) => style.textContent);

describe("bn-context page numbers", () => {
  it("numbers the pages by position, right away", async () => {
    const page = await render(
      `<bn-context>
        <bn-layout-page></bn-layout-page>
        <bn-page><bn-footer></bn-footer></bn-page>
        <bn-layout-page></bn-layout-page>
      </bn-context>`,
    );

    // no waiting: the old code wrote the numbers from a 250 ms timer
    expect(numbers(page.root)).toEqual(["1", "2", "3"]);
  });

  it("keeps a page number that the author set", async () => {
    const page = await render(
      `<bn-context>
        <bn-layout-page></bn-layout-page>
        <bn-layout-page page-number="A-1"></bn-layout-page>
        <bn-page><bn-footer page-number="iv"></bn-footer></bn-page>
        <bn-layout-page></bn-layout-page>
      </bn-context>`,
    );

    expect(numbers(page.root)).toEqual(["1", "A-1", "iv", "4"]);
  });

  it("numbers a page that is added later and moves the numbers it wrote itself", async () => {
    const page = await render(
      `<bn-context><bn-layout-page></bn-layout-page><bn-layout-page page-number="A-1"></bn-layout-page></bn-context>`,
    );

    page.root.insertBefore(page.doc.createElement("bn-layout-page"), page.root.firstChild);
    notifyChildListChange(page.root);

    expect(numbers(page.root)).toEqual(["1", "2", "A-1"]);
  });

  it("numbers a page again when the number it wrote is removed", async () => {
    const page = await render(
      `<bn-context><bn-layout-page></bn-layout-page><bn-layout-page></bn-layout-page></bn-context>`,
    );
    const second = page.root.querySelectorAll("bn-layout-page")[1];

    // a tool that updates the DOM in place drops attributes that are not in its source
    second.removeAttribute("page-number");
    notifyAttributeChange(second, "page-number");

    expect(numbers(page.root)).toEqual(["1", "2"]);
  });

  it("keeps a number that the author sets later", async () => {
    const page = await render(
      `<bn-context><bn-layout-page></bn-layout-page><bn-layout-page></bn-layout-page></bn-context>`,
    );
    const second = page.root.querySelectorAll("bn-layout-page")[1];

    second.setAttribute("page-number", "B");
    notifyAttributeChange(second, "page-number");

    expect(numbers(page.root)).toEqual(["1", "B"]);
  });

  it("keeps a page number that is set as a property, without the attribute", async () => {
    const page = await render(`<bn-context></bn-context>`);
    const layoutPage = page.doc.createElement("bn-layout-page") as unknown as HTMLElement & Record<string, string>;
    layoutPage.pageNumber = "A-1";

    page.root.append(layoutPage);
    notifyChildListChange(page.root);

    expect(layoutPage.hasAttribute("page-number")).toBe(false);
  });

  it("numbers a page again whose number was set as a property and then cleared", async () => {
    const page = await render(`<bn-context><bn-layout-page></bn-layout-page></bn-context>`);
    // an upgraded page has the property, and the property is what its footer shows: stand in for it here
    const layoutPage = page.root.querySelector("bn-layout-page") as unknown as HTMLElement & {
      pageNumber: string | null;
    };
    expect(layoutPage.getAttribute("page-number")).toBe("1");
    layoutPage.pageNumber = null;
    const setAttribute = jest.spyOn(layoutPage, "setAttribute");

    notifyChildListChange(page.root);

    // the attribute still holds the old number, but the page has none: it is written again
    expect(setAttribute).toHaveBeenCalledWith("page-number", "1");
  });

  it("leaves a page without footer alone", async () => {
    const page = await render(`<bn-context><bn-page></bn-page><bn-layout-page></bn-layout-page></bn-context>`);

    expect(page.root.querySelector("bn-page").hasAttribute("page-number")).toBe(false);
    expect(numbers(page.root)).toEqual(["2"]);
  });
});

describe("bn-context paper size", () => {
  it("writes one @page rule from the first page", async () => {
    await render(
      `<bn-context>
        <bn-layout-page page-format="a4" page-orientation="landscape"></bn-layout-page>
        <bn-layout-page page-format="a3"></bn-layout-page>
      </bn-context>`,
    );

    expect(pageSizeRules()).toEqual(["@page { size: 11.69in 8.27in; }"]);
  });

  it("reads format and orientation of a plain bn-page", async () => {
    await render(`<bn-context><bn-page format="full-hd"></bn-page></bn-context>`);

    expect(pageSizeRules()).toEqual(["@page { size: 1920px 1080px; }"]);
  });

  it("uses the orientation the document is printed in", async () => {
    await render(
      `<bn-context render-orientation="landscape">
        <bn-layout-page page-format="a4" page-orientation="portrait"></bn-layout-page>
      </bn-context>`,
    );

    // the portrait page is rotated onto a landscape sheet
    expect(pageSizeRules()).toEqual(["@page { size: 11.69in 8.27in; }"]);
  });

  it("takes the orientation from the renderOrientation property too", async () => {
    const page = await render(
      `<bn-context><bn-layout-page page-format="a4" page-orientation="portrait"></bn-layout-page></bn-context>`,
    );
    expect(pageSizeRules()).toEqual(["@page { size: 8.27in 11.69in; }"]);

    (page.root as HTMLBnContextElement).renderOrientation = "landscape";
    await page.waitForChanges();
    notifyAttributeChange(page.root, "render-orientation");

    expect(page.root.getAttribute("render-orientation")).toBe("landscape");
    expect(pageSizeRules()).toEqual(["@page { size: 11.69in 8.27in; }"]);
  });

  it.each([
    [
      "a layout page without format in a portrait document",
      `<bn-context render-orientation="portrait"><bn-layout-page></bn-layout-page></bn-context>`,
      // the default XGA page is turned, so the sheet is 768 x 1024
      "@page { size: 768px 1024px; }",
    ],
    [
      "a plain bn-page, which is never turned",
      `<bn-context render-orientation="landscape"><bn-page format="a4"></bn-page></bn-context>`,
      "@page { size: 8.27in 11.69in; }",
    ],
    [
      "a render-orientation it does not know",
      `<bn-context render-orientation="auto"><bn-layout-page page-format="a4" page-orientation="landscape"></bn-layout-page></bn-context>`,
      "@page { size: 11.69in 8.27in; }",
    ],
    [
      "an empty render-orientation",
      `<bn-context render-orientation=""><bn-layout-page page-format="a4" page-orientation="landscape"></bn-layout-page></bn-context>`,
      "@page { size: 11.69in 8.27in; }",
    ],
  ])("writes the size the first page is drawn in: %s", async (_name, html, rule) => {
    await render(html);

    expect(pageSizeRules()).toEqual([rule]);
  });

  it("reads a format that is set as a property, without the attribute", async () => {
    const page = await render(`<bn-context></bn-context>`);
    const layoutPage = page.doc.createElement("bn-layout-page") as unknown as HTMLElement & Record<string, string>;
    layoutPage.pageFormat = "a4";
    layoutPage.pageOrientation = "landscape";

    page.root.append(layoutPage);
    notifyChildListChange(page.root);

    expect(pageSizeRules()).toEqual(["@page { size: 11.69in 8.27in; }"]);
  });

  it("follows a change of the first page", async () => {
    const page = await render(`<bn-context><bn-layout-page page-format="a4"></bn-layout-page></bn-context>`);
    const first = page.root.querySelector("bn-layout-page");

    first.setAttribute("page-format", "letter");
    notifyAttributeChange(first, "page-format");

    expect(pageSizeRules()).toEqual(["@page { size: 8.5in 11in; }"]);
  });

  it("writes no rule without a page, and removes it with the context", async () => {
    const empty = await render(`<bn-context><bn-text></bn-text></bn-context>`);
    expect(pageSizeRules()).toEqual([]);
    empty.root.remove();

    const page = await render(`<bn-context><bn-page format="a4"></bn-page></bn-context>`);
    expect(pageSizeRules()).toHaveLength(1);

    page.root.querySelector("bn-page").remove();
    page.root.remove();
    expect(pageSizeRules()).toEqual([]);
  });

  it("lets only the first context of the document set the paper size", async () => {
    await render(
      `<bn-context><bn-page format="a4"></bn-page></bn-context><bn-context><bn-page format="a3"></bn-page></bn-context>`,
    );

    expect(pageSizeRules()).toEqual(["@page { size: 8.27in 11.69in; }"]);
  });
});
