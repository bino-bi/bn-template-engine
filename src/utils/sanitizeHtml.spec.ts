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
  });

  it("unwraps disallowed elements to their text content", () => {
    expect(sanitizeHtml("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("strips event handlers and javascript: urls", () => {
    expect(sanitizeHtml(`<a href="javascript:alert(1)" onclick="alert(1)">x</a>`)).toBe("<a>x</a>");
    expect(sanitizeHtml(`<img src="x" onerror="alert(1)" />`)).toBe(`<img src="x">`);
  });
});
