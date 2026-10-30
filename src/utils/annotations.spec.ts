import { MockDocument } from "@stencil/core/mock-doc";
import { annotationColor, annotationPageKey, parseLayerItems, parseListItems } from "./annotations";

describe("annotationColor", () => {
  it("is the highlight blue without a name", () => {
    expect(annotationColor()).toBe("var(--bn-annotation-color, #0070c0)");
  });

  it("resolves a name to its custom property, with a built-in value when it has one", () => {
    expect(annotationColor("negative")).toBe("var(--bn-annotation-color-negative, #ff0000)");
    expect(annotationColor("brand-1")).toBe("var(--bn-annotation-color-brand-1, var(--bn-annotation-color, #0070c0))");
  });

  it("does not let anything but a name into the style", () => {
    expect(annotationColor("red);background:url(x)")).toBe("var(--bn-annotation-color, #0070c0)");
    expect(annotationColor("#ff0000")).toBe("var(--bn-annotation-color, #0070c0)");
  });

  it("does not take a member of Object for a built-in colour", () => {
    expect(annotationColor("constructor")).toBe(
      "var(--bn-annotation-color-constructor, var(--bn-annotation-color, #0070c0))",
    );
  });
});

describe("parseLayerItems and parseListItems", () => {
  it("reads a JSON array of objects", () => {
    expect(parseLayerItems('[{"target":"t"}]')).toEqual([{ target: "t" }]);
  });

  it("takes a number as text, so a label of the layer and of the list compare equal", () => {
    expect(parseLayerItems('[{"label":1,"target":"t"}]')![0].label).toBe("1");
    expect(parseListItems('[{"label":1}]')![0].label).toBe("1");
  });

  it("drops a field that is not text", () => {
    const vnode = '{"$tag$":"img"}';
    expect(parseListItems(`[{"label":${vnode},"title":${vnode},"html":${vnode}}]`)).toEqual([{}]);
    expect(parseLayerItems(`[{"label":${vnode},"color":true,"target":${vnode}}]`)![0]).toEqual({ target: "" });
  });

  it("takes no value as no items", () => {
    expect(parseLayerItems(undefined)).toEqual([]);
    expect(parseListItems(" ")).toEqual([]);
  });

  it("gives undefined for anything else", () => {
    expect(parseLayerItems("not json")).toBeUndefined();
    expect(parseListItems('{"target":"t"}')).toBeUndefined();
    expect(parseLayerItems("[1]")).toBeUndefined();
    expect(parseListItems("[null]")).toBeUndefined();
  });
});

describe("annotationPageKey", () => {
  it("is the same on one page and differs between pages", () => {
    const doc = new MockDocument();
    doc.body.innerHTML =
      "<bn-layout-page><i id='a'></i><div><i id='b'></i></div></bn-layout-page><bn-layout-page><i id='c'></i></bn-layout-page>";
    const key = (id: string) => annotationPageKey(doc.getElementById(id) as unknown as Element);

    expect(key("a")).not.toBe("");
    expect(key("b")).toBe(key("a"));
    expect(key("c")).not.toBe(key("a"));
  });

  it("is empty outside of a page", () => {
    const doc = new MockDocument();
    expect(annotationPageKey(doc.createElement("i") as unknown as Element)).toBe("");
  });
});
