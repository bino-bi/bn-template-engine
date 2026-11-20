/**
 * The room of each segment of a chart with fixed scales. A segment has an
 * equal share of the width at least. What the others do not use of their
 * share goes to those that need more, the smallest need first. A segment whose
 * bars cannot get break marks is as wide as it is: its width counts as used. A
 * width that is not known yet counts as the equal share.
 *
 * @param total - width of the chart
 * @param widths - what each segment needs when no bar is cut, with the room beside it
 * @param fixed - segments that are drawn at their width whatever room they get
 * @param reserve - a part of the free room that is given to no segment
 */
export function segmentRooms(
  total: number,
  widths: (number | undefined)[],
  fixed: boolean[] = [],
  reserve: number = 0,
): number[] {
  const count = widths.length;
  const share = total / count;
  const rooms: number[] = new Array(count).fill(share);
  if (count < 2 || total <= 0) return rooms;

  const width = (index: number): number => widths[index] ?? share;
  // what is free when every segment that can be cut is at its share at most
  let free = total - reserve;
  const needy: number[] = [];
  for (let index = 0; index < count; index++) {
    if (fixed[index]) {
      free -= width(index);
    } else {
      free -= Math.min(width(index), share);
      if (width(index) > share) needy.push(index);
    }
  }
  if (free <= 0) return rooms;

  needy.sort((a, b) => width(a) - width(b));
  needy.forEach((index, position) => {
    const part = Math.min(width(index) - share, free / (needy.length - position));
    rooms[index] = share + part;
    free -= part;
  });
  return rooms;
}
