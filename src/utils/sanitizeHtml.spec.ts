import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("returns an empty string for blank input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
  });

  it("keeps plain text untouched", () => {
    expect(sanitizeHtml("Sales & Marketing")).toBe("Sales &amp; Marketing");
  });

  it("keeps allowed inline markup", () => {
    expect(sanitizeHtml("Line one<br />Line two")).toBe("Line one<br>Line two");
    expect(sanitizeHtml("<b>bold</b> and <em>italic</em>")).toBe("<b>bold</b> and <em>italic</em>");
    expect(sanitizeHtml("Use <code>asset:logo</code>, <del>not</del> this")).toBe(
      "Use <code>asset:logo</code>, <del>not</del> this",
    );
  });

  it.each([
    "<script>alert(1)</script>",
    "<font><img src=x onerror=alert(1)></font>",
    "<audio src=x onerror=alert(1)>",
    "<details open ontoggle=alert(1)>x</details>",
    "<svg><image href=x onerror=alert(1)>",
    `<form><input name="tagName"></form>`,
  ])("removes %s with its content", (html) => {
    expect(sanitizeHtml(html)).toBe("");
  });

  it("removes disallowed nodes inside allowed elements", () => {
    expect(sanitizeHtml("<p>a<script>alert(1)</script>b</p>")).toBe("<p>ab</p>");
    expect(sanitizeHtml("a<!-- note -->b")).toBe("ab");
  });

  it("strips event handlers and unknown attributes", () => {
    expect(sanitizeHtml(`<b onclick="alert(1)" id="x">x</b>`)).toBe("<b>x</b>");
    expect(sanitizeHtml(`<img src="x" onerror="alert(1)" />`)).toBe(`<img src="x">`);
  });

  it.each([
    "javascript:alert(1)",
    "java&#x09;script:alert(1)",
    "&#1;javascript:alert(1)",
    "javascript://a b/%0aalert(1)",
    "data:text/html,x",
    "blob:x",
  ])("removes the link target %s", (url) => {
    expect(sanitizeHtml(`<a href="${url}" onclick="alert(1)">x</a>`)).toBe("<a>x</a>");
  });

  it.each(["https://example.com/a?b=1", "mailto:a@example.com", "/reports/1", "page.html", "#top"])(
    "keeps the link target %s",
    (url) => {
      expect(sanitizeHtml(`<a href="${url}">x</a>`)).toBe(`<a href="${url}">x</a>`);
    },
  );

  it("allows data URLs for src only", () => {
    expect(sanitizeHtml(`<img src="data:image/png;base64,AAAA">`)).toBe(`<img src="data:image/png;base64,AAAA">`);
    expect(sanitizeHtml(`<img src="javascript:alert(1)">`)).toBe("<img>");
  });

  it("keeps text-align and removes any other style", () => {
    // mock-doc serializes the kept style as "text-align: center;"
    expect(sanitizeHtml(`<p style="text-align:center">x</p>`)).toContain("text-align");
    expect(sanitizeHtml(`<p style="text-align:center;position:fixed">x</p>`)).toBe("<p>x</p>");
    expect(sanitizeHtml(`<p style="background:url(//example.com/x)">x</p>`)).toBe("<p>x</p>");
  });
});
