import { ClassStyle } from "./attributes";

class StyleSheet {
  private readonly tag: Element;
  private cache = new Map<string, string>();

  constructor() {
    this.tag = StyleSheet.makeStyleTag();
  }

  private static makeStyleTag(): Element {
    const tag = document.createElement("style");
    tag.type = "text/css";
    tag.setAttribute("data-bn-computed-style", "");
    tag.append(document.createTextNode(""));
    (document.head || document.querySelector("head")).append(tag);
    return tag;
  }

  apply(data: Map<string, ClassStyle>) {
    data.forEach((value) => this.cache.set(value.className, value.style));
    this.tag.innerHTML = Array.from(this.cache.values())
      .map((value) => value)
      .join("\n");
  }
}

export const styleSheet = new StyleSheet();
