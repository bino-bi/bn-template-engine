import { MockDocument } from "@stencil/core/mock-doc";
import { place } from "../testing/place";
import { readSvgBaseline, readTableBaseline } from "./baseline";

const build = (markup: string): { host: Element; root: Element } => {
  const doc = new MockDocument();
  const host = doc.createElement("div");
  host.innerHTML = markup;
  place(host, { left: 100, top: 50, width: 400, height: 300 });
  return { host: host as unknown as Element, root: host as unknown as Element };
};

describe("readSvgBaseline", () => {
  it("takes y and the left end from a horizontal axis line", () => {
    const { host, root } = build(`<svg><g id="axis"><line class="axis-ac"></line></g></svg>`);
    place(root.querySelector("line"), { left: 120, top: 249, width: 300, height: 2 });

    expect(readSvgBaseline(root, host)).toEqual({ x: 20, y: 200 });
  });

  it("takes an axis above the bottom when there are negative values", () => {
    const { host, root } = build(`<svg><g id="axis"><line></line></g></svg>`);
    // a chart 300 high whose zero line sits at 120: the negative bars hang below it
    place(root.querySelector("line"), { left: 110, top: 169.5, width: 300, height: 1 });

    const baseline = readSvgBaseline(root, host);
    expect(baseline.y).toBe(120);
    expect(baseline.y!).toBeLessThan(300);
  });

  it("takes x and the top end from a vertical axis line", () => {
    const { host, root } = build(`<svg><g id="axis"><line></line></g></svg>`);
    place(root.querySelector("line"), { left: 179, top: 70, width: 2, height: 200 });

    expect(readSvgBaseline(root, host)).toEqual({ x: 80, y: 20 });
  });

  it("takes the bottom and the left edge of the first marked plot frame", () => {
    const { host, root } = build(
      `<svg><rect data-bn-baseline="frame"></rect><rect data-bn-baseline="frame"></rect></svg>`,
    );
    const [first, second] = Array.from(root.querySelectorAll("rect"));
    place(first, { left: 140, top: 60, width: 100, height: 100 });
    place(second, { left: 260, top: 60, width: 100, height: 100 });

    expect(readSvgBaseline(root, host)).toEqual({ x: 40, y: 110 });
  });

  it("prefers a marked axis line over the axis group", () => {
    const { host, root } = build(`<svg><line data-bn-baseline="axis"></line><g id="axis"><line></line></g></svg>`);
    const [marked, other] = Array.from(root.querySelectorAll("line"));
    place(marked, { left: 200, top: 60, width: 0, height: 100 });
    place(other, { left: 0, top: 0, width: 400, height: 1 });

    expect(readSvgBaseline(root, host)).toEqual({ x: 100, y: 10 });
  });

  it("is empty without an axis", () => {
    const { host, root } = build(`<svg><g id="Scenario1"></g></svg>`);
    expect(readSvgBaseline(root, host)).toEqual({});
  });
});

describe("readTableBaseline", () => {
  const TABLE = `<table>
      <thead><tr><th colspan="3">2024</th></tr><tr><th>Region</th><th>AC</th><th>PL</th></tr></thead>
      <tbody><tr><td>North</td><td>1</td><td>2</td></tr></tbody>
    </table>`;

  it("takes the bottom of the header and the left edge of the first value column", () => {
    const { host, root } = build(TABLE);
    const table = root.querySelector("table");
    place(table!.querySelector("thead"), { left: 100, top: 50, width: 400, height: 40 });
    const lastHeaderRow = table!.querySelectorAll("thead tr")[1];
    place(lastHeaderRow.children[1], { left: 260, top: 70, width: 60, height: 20 });

    expect(readTableBaseline(table, host)).toEqual({ x: 160, y: 40 });
  });

  it("takes x from the first body row when there is no header", () => {
    const { host, root } = build(`<table><tbody><tr><td>North</td><td>1</td></tr></tbody></table>`);
    const table = root.querySelector("table");
    place(table!.querySelectorAll("td")[1], { left: 230, top: 50, width: 60, height: 20 });

    expect(readTableBaseline(table, host)).toEqual({ x: 130 });
  });

  it("is empty before the table has drawn", () => {
    const { host } = build("");
    expect(readTableBaseline(null, host)).toEqual({});
  });
});

describe("readTableBaseline with an operation column", () => {
  it("takes the column after the category column, not the second one", () => {
    const doc = new MockDocument();
    const host = doc.createElement("div") as unknown as Element;
    host.innerHTML = `<table><thead><tr><th class="operation base"></th><th class="category base">Region</th><th class="ac1">AC</th></tr></thead></table>`;
    place(host, { left: 100, top: 50, width: 400, height: 300 });
    const table = host.querySelector("table");
    place(table!.querySelector("thead"), { left: 100, top: 50, width: 400, height: 20 });
    place(table!.querySelectorAll("th")[2], { left: 300, top: 50, width: 60, height: 20 });

    expect(readTableBaseline(table, host)).toEqual({ x: 200, y: 20 });
  });
});
