import { layoutStack, stackExtent, stackLabelSide } from "./stackLayout";

const edges = (values: number[], span?: number): [number, number][] =>
  layoutStack(values, span).segments.map((segment) => [segment.start, segment.end]);

describe("layoutStack", () => {
  it("stacks positive values on one side and negative values on the other", () => {
    const layout = layoutStack([10, -4, 6]);

    expect(edges([10, -4, 6])).toEqual([
      [0, 10],
      [0, -4],
      [10, 16],
    ]);
    expect(layout.positive).toBe(16);
    expect(layout.negative).toBe(4);
    expect(layout.total).toBe(12);
  });

  it("has the signed sum as total", () => {
    expect(layoutStack([10, -4]).total).toBe(6);
    expect(layoutStack([2, -10]).total).toBe(-8);
  });

  it("takes shares of the sum of absolute values", () => {
    expect(layoutStack([10, -4, 6]).segments.map((segment) => segment.share)).toEqual([0.5, -0.2, 0.3]);
  });

  it("lays out an all positive stack as before, with no negative side", () => {
    const layout = layoutStack([3, 5]);

    expect(edges([3, 5])).toEqual([
      [0, 3],
      [3, 8],
    ]);
    // toBe is Object.is: -0 would fail
    expect(layout.negative).toBe(0);
    expect(layout.segments[0].start).toBe(0);
  });

  it("stacks an all negative stack away from the axis", () => {
    const layout = layoutStack([-3, -5]);

    expect(edges([-3, -5])).toEqual([
      [0, -3],
      [-3, -8],
    ]);
    expect(layout.positive).toBe(0);
    expect(layout.total).toBe(-8);
  });

  it("scales a 100 % stack so that both sides together have the span", () => {
    const layout = layoutStack([10, -4, 6], 100);

    expect(layout.positive).toBe(80);
    expect(layout.negative).toBe(20);
    expect(edges([10, -4, 6], 100)).toEqual([
      [0, 50],
      [0, -20],
      [50, 80],
    ]);
    expect(layout.total).toBe(12);
  });

  it("gives no NaN for a stack of zeros", () => {
    const layout = layoutStack([0, 0], 1);

    expect(layout.segments).toEqual([
      { start: 0, end: 0, share: 0 },
      { start: 0, end: 0, share: 0 },
    ]);
    expect(layout.positive).toBe(0);
  });

  it("gives a value that is not a number no room", () => {
    const layout = layoutStack([10, NaN, 5]);

    expect(edges([10, NaN, 5])).toEqual([
      [0, 10],
      [10, 10],
      [10, 15],
    ]);
    expect(layout.total).toBe(15);
  });
});

describe("layoutStack: a segment without length", () => {
  it("puts a zero on the positive side", () => {
    expect(edges([-3, 0, -5])).toEqual([
      [0, -3],
      [0, 0],
      [-3, -8],
    ]);
  });

  it("puts a negative zero on the negative side, behind the segments before it", () => {
    // an area layer that is negative in the other periods stays below the axis
    expect(edges([-3, -0, -5])).toEqual([
      [0, -3],
      [-3, -3],
      [-3, -8],
    ]);
    expect(layoutStack([-3, -0, -5]).total).toBe(-8);
  });
});

describe("stackExtent", () => {
  it("takes the largest side and the highest and lowest total", () => {
    expect(stackExtent([layoutStack([10, -4, 6]), layoutStack([3, -9, 1])])).toEqual({
      positive: 16,
      negative: 9,
      maxTotal: 12,
      minTotal: -5,
    });
  });

  it("is zero without stacks", () => {
    expect(stackExtent([])).toEqual({ positive: 0, negative: 0, maxTotal: 0, minTotal: 0 });
  });
});

describe("stackLabelSide", () => {
  it("keeps the label side for a total of 0 or more and clears the negative segments", () => {
    expect(stackLabelSide([layoutStack([10, -4, 6])])).toEqual({ flipped: false, clearance: 4 });
  });

  it("flips for a negative total and clears the positive segments", () => {
    expect(stackLabelSide([layoutStack([2, -10])])).toEqual({ flipped: true, clearance: 2 });
  });

  it("needs no clearance for a one sided stack", () => {
    expect(stackLabelSide([layoutStack([3, 5])])).toEqual({ flipped: false, clearance: 0 });
    expect(stackLabelSide([layoutStack([-3, -5])])).toEqual({ flipped: true, clearance: 0 });
  });

  it("follows the front stack and clears every stack of the row", () => {
    expect(stackLabelSide([layoutStack([4, -7]), layoutStack([10, -2])])).toEqual({ flipped: false, clearance: 7 });
  });

  it("clears the total label of a back stack that sits on the side of the label", () => {
    // front total 10: label on the negative side. The back total -5 is printed there, 2 units long.
    const room = (): number => 2;

    expect(stackLabelSide([layoutStack([-5]), layoutStack([10])], room)).toEqual({ flipped: false, clearance: 7 });
    // front total -4: label on the positive side, behind the back total 6
    expect(stackLabelSide([layoutStack([6]), layoutStack([-4])], room)).toEqual({ flipped: true, clearance: 8 });
  });

  it("needs no room for a total label on the other side", () => {
    expect(stackLabelSide([layoutStack([5]), layoutStack([10, -1])], () => 2)).toEqual({
      flipped: false,
      clearance: 1,
    });
  });
});
