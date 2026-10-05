import { pageGeometry, pageRule, sheetGeometry, VALID_FORMATS } from "./pageFormats";

describe("page formats", () => {
  it("lists the documented formats", () => {
    expect(VALID_FORMATS).toEqual([
      "xga",
      "hd",
      "full-hd",
      "4k",
      "4k2k",
      "a6",
      "a5",
      "a4",
      "a3",
      "a2",
      "a1",
      "a0",
      "letter",
      "legal",
      "tabloid",
      "ledger",
    ]);
  });

  it.each([
    ["xga", "1024px", "768px", "landscape"],
    ["hd", "1280px", "720px", "landscape"],
    ["full-hd", "1920px", "1080px", "landscape"],
    ["4k", "3840px", "2160px", "landscape"],
    ["4k2k", "4096px", "2160px", "landscape"],
    ["a6", "4.13in", "5.83in", "portrait"],
    ["a5", "5.83in", "8.27in", "portrait"],
    ["a4", "8.27in", "11.69in", "portrait"],
    ["a3", "11.69in", "16.54in", "portrait"],
    ["a2", "16.54in", "23.39in", "portrait"],
    ["a1", "23.39in", "33.11in", "portrait"],
    ["a0", "33.11in", "46.81in", "portrait"],
    ["letter", "8.5in", "11in", "portrait"],
    ["legal", "8.5in", "14in", "portrait"],
    ["tabloid", "11in", "17in", "portrait"],
    ["ledger", "17in", "11in", "landscape"],
  ])("gives %s its true size, in its native orientation and turned", (format, width, height, native) => {
    const other = native === "landscape" ? "portrait" : "landscape";

    expect(pageGeometry(format)).toEqual({ width, height, orientation: native });
    expect(pageGeometry(format, native)).toEqual({ width, height, orientation: native });
    expect(pageGeometry(format, other)).toEqual({ width: height, height: width, orientation: other });
  });

  it("keeps the native orientation for an orientation it does not know", () => {
    expect(pageGeometry("a4", "sideways")).toEqual({ width: "8.27in", height: "11.69in", orientation: "portrait" });
  });

  it.each([undefined, null, "", "full_hd", "A4"])("falls back to XGA landscape for the format %p", (format) => {
    // the orientation has no effect without a known format
    expect(pageGeometry(format, "portrait")).toEqual({ width: "1024px", height: "768px", orientation: "landscape" });
  });

  it("turns a page onto a sheet of the other orientation", () => {
    expect(sheetGeometry("a4", "portrait", "landscape")).toEqual({ width: "11.69in", height: "8.27in", turned: true });
    expect(sheetGeometry("xga", undefined, "portrait")).toEqual({ width: "768px", height: "1024px", turned: true });
    // a page without a known format is drawn as XGA landscape, so it is turned too
    expect(sheetGeometry(undefined, "portrait", "portrait")).toEqual({
      width: "768px",
      height: "1024px",
      turned: true,
    });
  });

  it.each([undefined, null, "", "auto"])("turns nothing for the render orientation %p", (renderOrientation) => {
    expect(sheetGeometry("a4", "landscape", renderOrientation)).toEqual({
      width: "11.69in",
      height: "8.27in",
      turned: false,
    });
  });

  it("turns nothing when the page has the orientation of the sheet", () => {
    expect(sheetGeometry("a4", "landscape", "landscape").turned).toBe(false);
    expect(sheetGeometry("xga", undefined, "landscape").turned).toBe(false);
  });

  it("writes the size of the sheet as an @page rule, and no margin", () => {
    // a margin in the rule would override the margins of a caller that prints a header and a footer
    expect(pageRule("a4", "portrait", "landscape")).toBe("@page { size: 11.69in 8.27in; }");
    expect(pageRule("a4", "landscape")).toBe("@page { size: 11.69in 8.27in; }");
    expect(pageRule("full-hd")).toBe("@page { size: 1920px 1080px; }");
    expect(pageRule()).toBe("@page { size: 1024px 768px; }");
  });
});
