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

    expect(pageSizeRules()).toEqual(["@page { size: 11.69in 8.27in; margin: 0; }"]);
  });

  it("reads format and orientation of a plain bn-page", async () => {
    await render(`<bn-context><bn-page format="full-hd"></bn-page></bn-context>`);

    expect(pageSizeRules()).toEqual(["@page { size: 1920px 1080px; margin: 0; }"]);
  });

  it("uses the orientation the document is printed in", async () => {
    await render(
      `<bn-context render-orientation="landscape">
        <bn-layout-page page-format="a4" page-orientation="portrait"></bn-layout-page>
      </bn-context>`,
    );

    // the portrait page is rotated onto a landscape sheet
    expect(pageSizeRules()).toEqual(["@page { size: 11.69in 8.27in; margin: 0; }"]);
  });

  it("follows a change of the first page", async () => {
    const page = await render(`<bn-context><bn-layout-page page-format="a4"></bn-layout-page></bn-context>`);
    const first = page.root.querySelector("bn-layout-page");

    first.setAttribute("page-format", "letter");
    notifyAttributeChange(first, "page-format");

    expect(pageSizeRules()).toEqual(["@page { size: 8.5in 11in; margin: 0; }"]);
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

    expect(pageSizeRules()).toEqual(["@page { size: 8.27in 11.69in; margin: 0; }"]);
  });
});
