// nanoid ships ESM-only, which Stencil's jest transform cannot parse.
jest.mock("nanoid", () => ({ nanoid: () => "mock-id" }));

import { h } from "@stencil/core";
import { newSpecPage } from "@stencil/core/testing";
import { Context } from "./bn-context";
import { LAYOUT_STATE_VERSION } from "../../utils/layoutState";

describe("bn-context.getLayoutState", () => {
  const setup = async () => {
    const page = await newSpecPage({
      components: [Context],
      template: () => (
        <bn-context locale="de">
          <bn-text id="intro"></bn-text>
          <bn-table></bn-table>
          <div>
            <bn-table></bn-table>
            <bn-title></bn-title>
          </div>
        </bn-context>
      ),
    });
    // The `name` fallback is an attribute, not a typed prop - set it directly.
    page.root.querySelectorAll("bn-table")[1].setAttribute("name", "sales");
    return page;
  };

  it("lists every visual descendant in document order with generated ids", async () => {
    const page = await setup();
    const state = await page.rootInstance.getLayoutState();

    expect(state.version).toBe(LAYOUT_STATE_VERSION);
    expect(state.detail).toBe("summary");
    expect(state.context.locale).toBe("de");
    expect(state.components.map((c) => c.tag)).toEqual(["bn-text", "bn-table", "bn-table", "bn-title"]);
    expect(state.components.map((c) => c.id)).toEqual(["intro", "bn-table[0]", "sales", "bn-title[0]"]);
  });

  it("produces the generic fallback shape for components without their own method", async () => {
    const page = await setup();
    const state = await page.rootInstance.getLayoutState({ detail: "full" });

    expect(state.detail).toBe("full");
    const entry = state.components[0];
    expect(entry.version).toBe(LAYOUT_STATE_VERSION);
    expect(entry.rect.context).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(entry.rect.component).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(entry.em.fontSizePx).toBeGreaterThan(0);
    expect(entry.regions).toEqual([]);
    expect(entry.diagnostics).toEqual([]);
    expect(entry.elements).toBeUndefined();
    expect(entry.error).toBeUndefined();
  });

  it("passes has-error diagnostics through", async () => {
    const page = await setup();
    const items = [{ id: "WARN_overflow", type: "warning", message: "too wide" }];
    page.root.querySelector("bn-table").setAttribute("has-error", JSON.stringify(items));

    const state = await page.rootInstance.getLayoutState();
    expect(state.components[1].diagnostics).toEqual(items);
  });

  it("delegates to a component's own getLayoutState and forwards the detail level", async () => {
    const page = await setup();
    const rich = { version: LAYOUT_STATE_VERSION, tag: "bn-table", id: "", rect: undefined, elements: [] };
    const richMethod = jest.fn().mockResolvedValue({ ...rich });
    (page.root.querySelector("bn-table") as any).getLayoutState = richMethod;

    const state = await page.rootInstance.getLayoutState({ detail: "full" });
    expect(richMethod).toHaveBeenCalledWith({ detail: "full" });
    expect(state.components[1].elements).toEqual([]);
    expect(state.components[1].id).toBe("bn-table[0]");
  });

  it("turns a throwing component into an error entry without failing the call", async () => {
    const page = await setup();
    (page.root.querySelector("bn-title") as any).getLayoutState = () => {
      throw new Error("boom");
    };

    const state = await page.rootInstance.getLayoutState();
    const entry = state.components[3];
    expect(entry.tag).toBe("bn-title");
    expect(entry.error).toBe("boom");
    expect(entry.rect.context).toBeDefined();
    expect(state.components).toHaveLength(4);
  });
});
