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
  "code",
  "pre",
  "blockquote",
  "del",
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

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

const ALLOWED_STYLE = /^\s*text-align:\s*(left|center|right)\s*;?\s*$/i;

/**
 * Strips everything but the allowed tags and attributes from an HTML string.
 * The string is parsed into a separate inert document, so nothing in it loads
 * or runs. Disallowed elements are removed together with their content.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const body = new DOMParser().parseFromString(html, "text/html").body;
  sanitizeNode(body);
  return body.innerHTML;
}

function sanitizeNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    const el = child as Element;
    // localName, not tagName: a form control named "tagName" shadows that property on its form.
    if (child.nodeType !== Node.ELEMENT_NODE || !ALLOWED_TAGS.has(el.localName)) {
      node.removeChild(child);
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_ATTRS.has(name) || ((name === "href" || name === "src") && !isAllowedUrl(name, attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
    // Read through getAttribute: Stencil's mock-doc keeps style out of el.attributes.
    const style = el.getAttribute("style");
    if (style !== null && !ALLOWED_STYLE.test(style)) el.removeAttribute("style");
    sanitizeNode(el);
  }
}

function isAllowedUrl(name: string, value: string): boolean {
  try {
    // A fixed base lets relative URLs pass whatever the URL of the embedding page is.
    const { protocol } = new URL(value, "http://a");
    return ALLOWED_PROTOCOLS.has(protocol) || (name === "src" && protocol === "data:");
  } catch {
    return false;
  }
}
