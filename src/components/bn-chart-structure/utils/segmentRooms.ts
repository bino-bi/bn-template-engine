/**
 * The room of each segment of a chart with fixed scales. A segment starts with
 * an equal share of the width. One that needs less leaves the rest to those
 * that need more, the smallest need first. A segment whose bars cannot get
 * break marks is as wide as it is: it takes its width, and the others share
 * what is left. A width that is not known yet counts as the equal share.
 *
 * @param total - width of the chart
 * @param widths - what each segment needs when no bar is cut, with the room beside it
 * @param fixed - segments that are drawn at their width whatever room they get
 */
export function segmentRooms(total: number, widths: (number | undefined)[], fixed: boolean[] = []): number[] {
  const count = widths.length;
  const equal: number[] = new Array(count).fill(total / count);
  if (count < 2 || total <= 0) return equal;
  // as long as every segment fits its share nothing changes
  if (widths.every((width) => (width ?? 0) <= total / count)) return equal;

  const width = (index: number): number => widths[index] ?? total / count;
  const flexible: number[] = [];
  let left = total;
  for (let index = 0; index < count; index++) {
    if (fixed[index]) left -= width(index);
    else flexible.push(index);
  }
  if (flexible.length === 0 || left <= 0) return equal;

  const share = left / flexible.length;
  const rooms: number[] = widths.map((_, index) => (fixed[index] ? width(index) : share));
  let free = 0;
  const needy: number[] = [];
  for (const index of flexible) {
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
