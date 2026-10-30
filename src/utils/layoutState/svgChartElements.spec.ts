import { MockDocument } from "@stencil/core/mock-doc";
import { BarElement, LabelElement, PointElement } from "./types";
import { collectChartSegmentElements, collectXYElements, countPrimaryDataPoints } from "./svgChartElements";

const origins = { context: { x: 0, y: 0 }, component: { x: 0, y: 0 } };

const svgOf = (markup: string): Element => {
  const doc = new MockDocument();
  const host = doc.createElement("div");
  host.innerHTML = `<svg id="drawCanvas">${markup}</svg>`;
  return host.querySelector("svg") as unknown as Element;
};

const STACKED = `
  <g id="StackedScenarios">
    <g id="stacked_col_0_seg_0" data-bn-date="2024-01-01" data-bn-scenario="ac1" data-bn-part="element"><rect></rect></g>
    <g id="stacked_col_0_seg_1" data-bn-date="2024-01-01" data-bn-scenario="ac2" data-bn-part="element"><rect></rect></g>
    <g id="StackedScenarios_STACK_SEG_Label" data-bn-date="2024-01-01" data-bn-scenario="ac1" data-bn-part="label"><text>10</text></g>
    <g id="StackedScenarios_STACK_TOTAL_Label" data-bn-date="2024-01-01" data-bn-part="total"><text>18</text></g>
    <g id="stacked_col_1_seg_0"></g>
    <g id="stacked_col_2_seg_0" data-bn-date="2026-01-01" data-bn-scenario="ac1" data-bn-part="element"><rect></rect></g>
  </g>`;

describe("collectChartSegmentElements", () => {
  it("reports the segments of a stack with their key, but not a segment that draws nothing", () => {
    const bars = collectChartSegmentElements(svgOf(STACKED), "base", origins).filter(
      (element) => element.kind === "bar",
    ) as BarElement[];

    expect(bars.map((bar) => [bar.id, bar.index, bar.scenario])).toEqual([
      ["stacked_col_0_seg_0", 0, "stack:ac1"],
      ["stacked_col_0_seg_1", 0, "stack:ac2"],
      ["stacked_col_2_seg_0", 2, "stack:ac1"],
    ]);
    expect(bars[0].point).toEqual({ date: "2024-01-01", scenario: "ac1", part: "element" });
  });

  it("reports stack totals and the value labels of a stack", () => {
    const labels = collectChartSegmentElements(svgOf(STACKED), "base", origins).filter(
      (element) => element.kind === "label",
    ) as LabelElement[];

    expect(labels.map((label) => [label.text, label.point?.part])).toEqual([
      ["10", "label"],
      ["18", "total"],
    ]);
  });

  it("reports the value label a column moves into the label layer, exactly once", () => {
    const elements = collectChartSegmentElements(
      svgOf(`
        <g id="Scenario1"><g id="0"><g id="0_RECT" data-bn-date="2024-01-01" data-bn-part="element"><rect></rect></g><g id="0_DATA_Label"></g></g></g>
        <g id="label"><g id="0" data-bn-date="2024-01-01" data-bn-part="label"><text>120</text></g></g>`),
      "base",
      origins,
    );

    const labels = elements.filter((element) => element.kind === "label") as LabelElement[];
    expect(labels.map((label) => [label.text, label.index, label.point?.part])).toEqual([["120", 0, "label"]]);
    expect(elements.filter((element) => element.kind === "bar")).toHaveLength(1);
  });

  it("reports a line or scenario marker as a point", () => {
    const elements = collectChartSegmentElements(
      svgOf(
        `<g id="Scenario3"><g id="1"><polygon data-bn-date="2024-01-01" data-bn-scenario="pp1" data-bn-part="element"></polygon></g></g>`,
      ),
      "base",
      origins,
    );

    const [mark] = elements as PointElement[];
    expect(mark.kind).toBe("point");
    expect(mark.series).toBe("pp1");
    expect(mark.index).toBe(1);
    expect(mark.point?.date).toBe("2024-01-01");
  });

  it("leaves a group without a part out", () => {
    const elements = collectChartSegmentElements(
      svgOf(`<g id="Scenario1"><g id="0" data-bn-date="2024-01-01"></g></g>`),
      "base",
      origins,
    );
    expect(elements).toEqual([]);
  });
});

describe("countPrimaryDataPoints", () => {
  it("counts the groups of the primary scenario layer", () => {
    expect(countPrimaryDataPoints(svgOf(`<g id="Scenario1"><g id="0"></g><g id="1"></g><g id="label"></g></g>`))).toBe(
      2,
    );
  });

  it("counts the stacks of a stacked chart that draw something", () => {
    expect(countPrimaryDataPoints(svgOf(STACKED))).toBe(2);
  });

  it("is 0 for an empty chart", () => {
    expect(countPrimaryDataPoints(svgOf(`<g id="Scenarios"></g>`))).toBe(0);
  });
});

describe("collectXYElements", () => {
  it("reports keyed rects as bars next to the circles", () => {
    const elements = collectXYElements(
      svgOf(`
        <circle data-bn-category="A" data-bn-part="element"></circle>
        <rect></rect>
        <rect data-bn-category="B" data-bn-scenario="ac1" data-bn-part="element"></rect>
        <text data-bn-category="B" data-bn-part="label">12</text>`),
      origins,
    );

    expect(elements.map((element) => element.kind)).toEqual(["point", "bar", "label"]);
    const bar = elements[1] as BarElement;
    expect(bar.scenario).toBe("ac1");
    expect(bar.point?.category).toBe("B");
    expect((elements[2] as LabelElement).point?.part).toBe("label");
  });
});
