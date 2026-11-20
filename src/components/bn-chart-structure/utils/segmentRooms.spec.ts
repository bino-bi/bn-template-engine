import { segmentRooms } from "./segmentRooms";

describe("segmentRooms", () => {
  it("keeps the equal shares while every segment fits", () => {
    expect(segmentRooms(900, [290, 200, 100], 5)).toEqual([300, 300, 300]);
    expect(segmentRooms(900, [undefined, undefined, undefined], 5)).toEqual([300, 300, 300]);
  });

  it("gives a wide segment what the others leave", () => {
    // shares of 295: the others leave 95 + 195, the first needs 105 more
    expect(segmentRooms(900, [400, 200, 100], 5)).toEqual([400, 295, 295]);
  });

  it("splits what is free between two wide segments, the smaller need first", () => {
    // shares of 295: 195 are free, the second needs 25, the first gets the other 170
    const rooms = segmentRooms(900, [600, 320, 100], 5);
    expect(rooms).toEqual([465, 320, 295]);
    // a segment uses its room at most: with the margins the chart is as wide as it may be
    const used = [600, 320, 100].map((width, index) => Math.min(width, rooms[index]) + 5);
    expect(used.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(900);
  });

  it("gives no more than the width when nothing is free", () => {
    expect(segmentRooms(900, [500, 500, 500], 0)).toEqual([300, 300, 300]);
  });

  it("counts a width that is not known as the share", () => {
    expect(segmentRooms(900, [400, undefined, 100], 0)).toEqual([400, 300, 300]);
  });

  it("has one room for one segment", () => {
    expect(segmentRooms(900, [2000], 5)).toEqual([900]);
  });
});
