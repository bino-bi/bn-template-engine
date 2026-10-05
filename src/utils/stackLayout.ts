/** One segment of a laid-out stack, as signed distance from the axis. */
export interface StackSegment {
  /** Edge nearer the axis. */
  start: number;
  /** Outer edge: above `start` for a positive value, below it for a negative one. */
  end: number;
  /** Signed share of the sum of absolute values of the stack. */
  share: number;
}

/** A stack laid out on both sides of the axis. */
export interface StackLayout {
  /** In the order of the input values. */
  segments: StackSegment[];
  /** Extent of the positive side, >= 0. */
  positive: number;
  /** Extent of the negative side, >= 0. */
  negative: number;
  /** Signed sum of the values. */
  total: number;
}

/**
 * Stacks positive values outward on the positive side of the axis and negative values
 * outward on the other side. A value that is not finite takes no room. A zero has no
 * length and sits on the positive side; pass -0 to put it on the negative side.
 *
 * With `relativeSpan` > 0 the stack is a 100 % stack: lengths are scaled so that both
 * sides together are `relativeSpan` long. `total` is always the sum of the raw values.
 */
export function layoutStack(values: number[], relativeSpan: number = 0): StackLayout {
  let positive = 0;
  let negative = 0;
  let total = 0;

  const raw = values.map((input) => {
    const value = Number.isFinite(input) ? input : 0;
    total += value;

    if (value < 0 || Object.is(value, -0)) {
      const start = 0 - negative;
      negative -= value;
      return { value, start, end: 0 - negative };
    }
    const start = positive;
    positive += value;
    return { value, start, end: positive };
  });

  // the share base is the sum of absolute values, so a 100 % stack keeps its length
  const base = positive + negative;
  let scale = 1;
  if (relativeSpan > 0) {
    scale = base > 0 ? relativeSpan / base : 0;
  }

  return {
    segments: raw.map((segment) => ({
      start: segment.start * scale,
      end: segment.end * scale,
      share: base > 0 ? segment.value / base : 0,
    })),
    positive: positive * scale,
    negative: negative * scale,
    total,
  };
}

/** Largest positive and negative side and the highest and lowest total of several stacks. */
export function stackExtent(layouts: StackLayout[]): {
  positive: number;
  negative: number;
  maxTotal: number;
  minTotal: number;
} {
  const extent = { positive: 0, negative: 0, maxTotal: 0, minTotal: 0 };

  for (const layout of layouts) {
    extent.positive = Math.max(extent.positive, layout.positive);
    extent.negative = Math.max(extent.negative, layout.negative);
    extent.maxTotal = Math.max(extent.maxTotal, layout.total);
    extent.minTotal = Math.min(extent.minTotal, layout.total);
  }

  return extent;
}

/**
 * Where the category label of one row goes. `layouts` are the stacks of the row, the
 * front one last. The label sits opposite the total of the front stack (as for a plain
 * bar: opposite its value), `clearance` away from the axis, behind the segments there.
 *
 * A stack behind the front one can have its total on the other side than the front
 * stack, which is the side of the category label. `totalLabelRoom` gives the room the
 * total label of a stack takes behind its segments, in the units of the layout.
 */
export function stackLabelSide(
  layouts: StackLayout[],
  totalLabelRoom: (layout: StackLayout) => number = () => 0,
): { flipped: boolean; clearance: number } {
  const front = layouts[layouts.length - 1];
  const flipped = front != null && front.total < 0;

  const clearance = layouts.map((layout) => {
    const side = flipped ? layout.positive : layout.negative;
    const totalIsOnThisSide = flipped ? layout.total >= 0 : layout.total < 0;
    return side + (totalIsOnThisSide ? totalLabelRoom(layout) : 0);
  });

  return { flipped, clearance: Math.max(0, ...clearance) };
}
