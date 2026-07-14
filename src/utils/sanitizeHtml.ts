const ALLOWED_TAGS = new Set([
  "br",
  "b",
  "i",
  "strong",
  "em",
  "span",
  "p",
  "div",
  "table",
  "tr",
  "td",
  "th",
  "thead",
  "tbody",
  "tfoot",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "sub",
  "sup",
  "small",
  "hr",
  "a",
  "img",
]);

const ALLOWED_ATTRS = new Set([
  "class",
  "style",
  "colspan",
  "rowspan",
  "href",
  "title",
  "src",
  "alt",
  "width",
  "height",
]);

/**
 * Strips everything but the allowed tags and attributes from an HTML string.
 * Disallowed elements are replaced by their text content; event handlers,
 * unknown attributes and `javascript:` URLs are removed.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const container = document.createElement("div");
  container.innerHTML = html;
  sanitizeNode(container);
  return container.innerHTML;
}

function sanitizeNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
      node.replaceChild(document.createTextNode(el.textContent || ""), el);
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
        el.removeAttribute(attr.name);
      } else if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      } else if (name === "style" && /expression|javascript/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    sanitizeNode(el);
  }
}
