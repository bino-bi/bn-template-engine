import { newE2EPage } from "@stencil/core/testing";

describe("bn-map", () => {
  it("renders", async () => {
    const page = await newE2EPage();
    await page.setContent("<bn-map></bn-map>");

    const element = await page.find("bn-map");
    expect(element).toHaveClass("hydrated");
  });
});
