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

  it("takes the width of a segment that cannot be cut off the rest", () => {
    // the pins are 380 wide whatever room they get: the bars and the other variance share 520
    const widths = [600, 150, 380];
    const rooms = segmentRooms(900, widths, [false, false, true]);
    expect(rooms).toEqual([370, 260, 380]);
    expect(used(widths, rooms)).toBeLessThanOrEqual(900);
  });

  it("keeps the equal shares when the fixed segments alone fill the chart", () => {
    expect(segmentRooms(900, [600, 500, 500], [false, true, true])).toEqual([300, 300, 300]);
  });
});
