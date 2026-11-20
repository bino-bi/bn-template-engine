/**
 * Height the base segment of a chart gets on top of its share: what the drawn
 * variance segments leave of their shares, minus what others take beyond
 * theirs. A segment that is not drawn yet (height 0) keeps its share.
 */
export function measureHeightBonus(share: number, heights: number[]): number {
  let bonus = 0;
  for (const height of heights) {
    if (height > 0) {
      bonus += share - height;
    }
  }
  return Math.max(0, bonus);
}

/**
 * The bonus to apply after a measurement. A smaller bonus always counts,
 * else the chart is higher than its parent. A bonus that grows by a few
 * pixels is jitter and must not cause a re-render.
 */
export function settleHeightBonus(current: number, measured: number): number {
  const delta = measured - current;
  return delta < -1 || delta > 8 ? measured : current;
}
