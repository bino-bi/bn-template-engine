import { LabelCandidate, PointLabeler } from "./PointLabeler";

const FRAME = { x: 0, y: 0, width: 1000, height: 600 };

const candidate = (over: Partial<LabelCandidate>): LabelCandidate => ({
  name: "P1",
  cx: 500,
  cy: 300,
  r: 10,
  width: 60,
  height: 14,
  ...over,
});

describe("PointLabeler", () => {
  describe("selectCandidates", () => {
    const points = [{ name: "A" }, { name: "B" }, { name: "C" }];
    const labeler = new PointLabeler(FRAME, 4);

    it("'none' selects nothing", () => {
      expect(labeler.selectCandidates(points, "none", 12, (p) => p.name).selected).toEqual([]);
    });

    it("'all' selects every point", () => {
      expect(labeler.selectCandidates(points, "all", 1, (p) => p.name).selected).toHaveLength(3);
    });

    it("'auto' caps at max, assuming pre-ranked input", () => {
      const { selected } = labeler.selectCandidates(points, "auto", 2, (p) => p.name);
      expect(selected.map((p) => p.name)).toEqual(["A", "B"]);
    });

    it("an explicit list selects exactly those names and reports unknown ones", () => {
      const { selected, unknownNames } = labeler.selectCandidates(points, ["B", "Nope"], 12, (p) => p.name);
      expect(selected.map((p) => p.name)).toEqual(["B"]);
      expect(unknownNames).toEqual(["Nope"]);
    });
  });

  describe("place", () => {
    it("prefers the north anchor in open space", () => {
      const labeler = new PointLabeler(FRAME, 4);
      const placed = labeler.place([candidate({})]);
      expect(placed).toHaveLength(1);
      expect(placed[0].anchor).toBe("n");
      // Box sits fully above the mark.
      expect(placed[0].y + placed[0].candidate.height).toBeLessThan(300 - 10);
    });

    it("falls to the next clockwise anchor when north is blocked", () => {
      const labeler = new PointLabeler(FRAME, 4);
      // A mark directly above blocks the north box.
      labeler.registerMark(500, 270, 15);
      const placed = labeler.place([candidate({})]);
      expect(placed).toHaveLength(1);
      expect(placed[0].anchor).not.toBe("n");
    });

    it("rejects placements outside the frame", () => {
      const labeler = new PointLabeler(FRAME, 4);
      // Mark at the very top: the north box would leave the frame.
      const placed = labeler.place([candidate({ cy: 8 })]);
      expect(placed).toHaveLength(1);
      expect(placed[0].anchor).not.toBe("n");
      expect(placed[0].y).toBeGreaterThanOrEqual(0);
    });

    it("drops labels that fit nowhere instead of drawing leader lines", () => {
      const tinyFrame = { x: 0, y: 0, width: 30, height: 30 };
      const labeler = new PointLabeler(tinyFrame, 4);
      const placed = labeler.place([candidate({ cx: 15, cy: 15, width: 60 })]);
      expect(placed).toHaveLength(0);
    });

    it("avoids collisions between labels of nearby points", () => {
      const labeler = new PointLabeler(FRAME, 4);
      const placed = labeler.place([candidate({ name: "A" }), candidate({ name: "B", cx: 505, cy: 300 })]);
      expect(placed).toHaveLength(2);

      const [a, b] = placed;
      const overlap = !(
        a.x + a.candidate.width < b.x ||
        b.x + b.candidate.width < a.x ||
        a.y + a.candidate.height < b.y ||
        b.y + b.candidate.height < a.y
      );
      expect(overlap).toBe(false);
    });

    it("puts a label with a fixed side there, also outside the frame and on a mark", () => {
      const labeler = new PointLabeler(FRAME, 4);
      labeler.registerMark(500, 0, 30);
      const [placed] = labeler.place([candidate({ cy: 5, side: "n" })]);
      expect(placed.anchor).toBe("n");
      expect(placed.y).toBeLessThan(0);
    });

    it("keeps the other labels clear of one with a fixed side, whatever the order", () => {
      const labeler = new PointLabeler(FRAME, 4);
      const free = candidate({ name: "free", cx: 500 });
      const fixed = candidate({ name: "fixed", cx: 520, side: "n" });
      const placed = labeler.place([free, fixed]);
      expect(placed.find((p) => p.candidate.name === "fixed")!.anchor).toBe("n");
      expect(placed.find((p) => p.candidate.name === "free")!.anchor).not.toBe("n");
    });

    it("keeps labels off registered marks", () => {
      const labeler = new PointLabeler(FRAME, 4);
      labeler.registerMark(500, 300, 10);
      const placed = labeler.place([candidate({})]);
      expect(placed).toHaveLength(1);
      // The label box must not intersect the mark's bounding square.
      const box = placed[0];
      const intersects = !(
        box.x + box.candidate.width < 490 ||
        510 < box.x ||
        box.y + box.candidate.height < 290 ||
        310 < box.y
      );
      expect(intersects).toBe(false);
    });
  });
});
