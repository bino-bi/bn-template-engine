import { segmentRooms } from "./segmentRooms";

const used = (widths: number[], rooms: number[]): number =>
  widths.reduce((sum, width, index) => sum + Math.min(width, rooms[index]), 0);

describe("segmentRooms", () => {
  it("keeps the equal shares while every segment fits", () => {
    expect(segmentRooms(900, [290, 200, 100])).toEqual([300, 300, 300]);
    expect(segmentRooms(900, [undefined, undefined, undefined])).toEqual([300, 300, 300]);
  });

  it("gives a wide segment what the others leave", () => {
    expect(segmentRooms(900, [400, 200, 100])).toEqual([400, 300, 300]);
  });

  it("splits what is free between two wide segments, the smaller need first", () => {
    // 200 are free: the second needs 20, the first gets the other 180
    const rooms = segmentRooms(900, [600, 320, 100]);
    expect(rooms).toEqual([480, 320, 300]);
    expect(used([600, 320, 100], rooms)).toBeLessThanOrEqual(900);
  });

  it("gives no more than the width when nothing is free", () => {
    expect(segmentRooms(900, [500, 500, 500])).toEqual([300, 300, 300]);
  });

  it("counts a width that is not known as the share", () => {
    expect(segmentRooms(900, [400, undefined, 100])).toEqual([400, 300, 300]);
  });

  it("has one room for one segment", () => {
    expect(segmentRooms(900, [2000])).toEqual([900]);
  });

  it("counts the width of a segment that cannot be cut as used", () => {
    // the pins are 380 wide whatever room they get: 70 are free for the bars
    const widths = [600, 150, 380];
    const rooms = segmentRooms(900, widths, [false, false, true]);
    expect(rooms[0]).toBe(370);
    // the fixed segment draws its 380 whatever its room says
    expect(used(widths, [rooms[0], rooms[1], 380])).toBeLessThanOrEqual(900);
  });

  it("keeps a reserve of the free room back", () => {
    expect(segmentRooms(900, [400, 200, 100], [], 250)).toEqual([350, 300, 300]);
    expect(segmentRooms(900, [400, 200, 100], [], 500)).toEqual([300, 300, 300]);
  });

  it("gives no segment less than its equal share", () => {
    // the fixed segments fill more than their shares: the bars keep theirs
    expect(segmentRooms(900, [600, 500, 500], [false, true, true])).toEqual([300, 300, 300]);
    expect(segmentRooms(690, [664.6, 248.2, 203.8], [false, true, true])[0]).toBeCloseTo(238);
  });
});
