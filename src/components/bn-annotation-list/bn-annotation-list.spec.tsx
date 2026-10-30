// jest.mock must physically precede the imports (Stencil's transform does not hoist it).
let nextId = 0;
jest.mock("nanoid", () => ({ nanoid: () => `id-${nextId++}` }));

jest.mock("../../context/context-protocol", () => {
  const { createStore } = require("@stencil/store");
  const { SYSTEM_STYLE_DEFAULTS } = require("../../stores/componentStyles");
  const stores = {
    annotationsUnplaced: createStore({}),
    componentStyles: createStore({ _system: SYSTEM_STYLE_DEFAULTS }),
  };
  return { getStores: () => stores, clearStoresCache: () => {}, findContextElement: () => undefined };
});

import { newSpecPage } from "@stencil/core/testing";
import { AnnotationList } from "./bn-annotation-list";
import { getStores } from "../../context/context-protocol";
import { annotationPageKey } from "../../utils/annotations";

const ITEMS = JSON.stringify([
  { label: "1", title: "First", html: "one" },
  { label: "2", title: "Second", html: "two" },
  { title: "Third", html: "three" },
]);

const render = async (items: string, wrapper = "bn-layout-page") => {
  const page = await newSpecPage({
    components: [AnnotationList],
    html: `<${wrapper}><bn-annotation-list items='${items}'></bn-annotation-list></${wrapper}>`,
  });
  const list = page.body.querySelector("bn-annotation-list") as HTMLElement;
  const entries = () =>
    Array.from(list.shadowRoot!.querySelectorAll("li")).map((li) => [
      li.querySelector(".badge")?.textContent ?? null,
      li.querySelector(".title")?.textContent?.trim() ?? null,
    ]);
  return { page, list, entries };
};

describe("bn-annotation-list", () => {
  it("prints the circle, the title and the text, and no circle without a number", async () => {
    const { entries, list } = await render(ITEMS);
    expect(entries()).toEqual([
      ["1", "First"],
      ["2", "Second"],
      [null, "Third"],
    ]);
    expect(list.shadowRoot!.querySelector(".text")!.textContent).toContain("one");
  });

  it("drops the circle of a mark that could not be placed on its page, and keeps the other numbers", async () => {
    const { page, list, entries } = await render(ITEMS);

    getStores(list).annotationsUnplaced.set(annotationPageKey(list), ["1"]);
    await page.waitForChanges();

    expect(entries()).toEqual([
      [null, "First"],
      ["2", "Second"],
      [null, "Third"],
    ]);
    // the entry keeps the room of its circle, so the list does not change its height
    expect(list.shadowRoot!.querySelectorAll(".badge-space")).toHaveLength(1);
  });

  it("ignores the labels of another page", async () => {
    const { page, list, entries } = await render(ITEMS);

    getStores(list).annotationsUnplaced.set("another-page", ["1", "2"]);
    await page.waitForChanges();

    expect(entries()[0][0]).toBe("1");
  });

  it("reports items that are not a JSON array", async () => {
    const { list, entries } = await render("not json");

    expect(entries()).toEqual([]);
    expect(JSON.parse(list.getAttribute("has-error")!)[0].id).toBe("ERR_items");
  });
});
