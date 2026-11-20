/**
 * The room of each segment of a chart with fixed scales. A segment starts with
 * an equal share of the width. One that needs less leaves the rest to those
 * that need more, the smallest need first. A width that is not known yet counts
 * as the share.
 *
 * @param total - width of the chart
 * @param widths - what each segment needs when no bar is cut
 * @param margin - room beside each segment that is no part of it
 */
export function segmentRooms(total: number, widths: (number | undefined)[], margin: number): number[] {
  const count = widths.length;
  const equal: number[] = new Array(count).fill(total / count);
  if (count < 2 || total <= 0) return equal;
  // as long as every segment fits its share nothing changes
  if (widths.every((width) => (width ?? 0) + margin <= total / count)) return equal;

  const share = (total - count * margin) / count;
  const width = (index: number): number => widths[index] ?? share;
  const rooms: number[] = new Array(count).fill(share);
  let free = 0;
  const needy: number[] = [];
  for (let index = 0; index < count; index++) {
    if (width(index) > share) needy.push(index);
    else free += share - width(index);
  }
  needy.sort((a, b) => width(a) - width(b));
  needy.forEach((index, position) => {
    const part = Math.min(width(index) - share, free / (needy.length - position));
    rooms[index] = share + part;
    free -= part;
  });
  return rooms;
}
