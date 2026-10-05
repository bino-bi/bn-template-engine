import { getContrastTextColor } from "./stackColors";

const BLACK = "#000000";
const WHITE = "#ffffff";

describe("getContrastTextColor", () => {
  it.each([
    ["#ffffff", BLACK],
    ["#c0c0c0", BLACK],
    ["#808080", WHITE],
    ["#000000", WHITE],
    ["#404040", WHITE],
  ])("reads the six digit colour %s", (fill, expected) => {
    expect(getContrastTextColor(fill)).toBe(expected);
  });

  // every colour that is not six digit hex got white text, also on a white fill
  it.each([
    ["#fff", BLACK],
    ["#FFF", BLACK],
    ["#000", WHITE],
    ["#ffff", BLACK],
    ["#ffffff80", BLACK],
    ["#00000080", WHITE],
    ["rgb(255, 255, 255)", BLACK],
    ["rgb(0,0,0)", WHITE],
    ["rgba(192, 192, 192, 0.5)", BLACK],
    ["rgb(100% 100% 100%)", BLACK],
  ])("reads %s", (fill, expected) => {
    expect(getContrastTextColor(fill)).toBe(expected);
  });

  it.each(["white", "url(#pattern-fc)", "", "#12"])("takes black text for '%s', which it cannot read", (fill) => {
    expect(getContrastTextColor(fill)).toBe(BLACK);
  });
});
