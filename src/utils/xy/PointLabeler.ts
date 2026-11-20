import { LabelBounds, LabelCollisionManager } from "../../components/bn-chart-time/utils/helper/LabelCollisionManager";
import { HookLocation } from "../../components/bn-chart-time/utils/elements/Label";
import { LabelConfig } from "./model/AxisConfig";
import { Rect } from "./FacetGrid";

/** Candidate anchor positions, tried clockwise starting north (IBCS: labels proximate to their marks). */
export type LabelAnchor = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const ANCHORS: LabelAnchor[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

/** A label to place: the mark it belongs to plus the measured text box. */
export interface LabelCandidate {
  name: string;
  /** Mark center, pixel coordinates. */
  cx: number;
  cy: number;
  /** Mark radius in pixels. */
  r: number;
  /** Measured text box. */
  width: number;
  height: number;
  /** A fixed side. The label stands there, also outside the frame or on a mark. */
  side?: LabelAnchor;
}

/** A successfully placed label; `x`/`y` is the label box's top-left corner. */
export interface PlacedLabel {
  candidate: LabelCandidate;
  x: number;
  y: number;
  anchor: LabelAnchor;
}

/** Result of candidate selection. */
export interface LabelSelection<T> {
  selected: T[];
  /** Names from an explicit `labels.points` list that match no point. */
  unknownNames: string[];
}

const DIAGONAL = Math.SQRT1_2;

/**
 * Selective point labeling with greedy collision-free placement for the XY
 * charts. Composes the existing {@link LabelCollisionManager} (AABB
 * register/hasCollision core); marks are pre-registered as bounding
 * squares - conservative for circles, acceptable for label proximity.
 *
 * Placement tries eight anchors clockwise from north and rejects positions
 * that leave the frame or collide with marks or other labels; unplaceable
 * labels are dropped (IBCS wants proximate labels - no leader lines).
 * With `onMarks` a label that finds no free place may stand on a mark,
 * but never on another label.
 */
export class PointLabeler {
  /** Placed labels and fixed text. A label never stands on one of these. */
  private readonly texts = new LabelCollisionManager();
  /** The boxes of the marks, to tell how much of a label would stand on them. */
  private readonly markBoxes: Rect[] = [];

  constructor(
    private readonly frame: Rect,
    private readonly gapPx: number,
    private readonly manager: LabelCollisionManager = new LabelCollisionManager(),
    private readonly onMarks: boolean = false,
  ) {}

  /** Registers a mark so labels avoid it (bounding-square approximation). */
  public registerMark(cx: number, cy: number, r: number): void {
    this.manager.register(this.bounds(cx - r, cy - r, 2 * r, 2 * r));
    this.markBoxes.push({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r });
  }

  /** Registers a text that is drawn by someone else (a panel title), so no label stands on it. */
  public registerText(x: number, y: number, width: number, height: number): void {
    this.texts.register(this.bounds(x, y, width, height));
  }

  /**
   * Selects which points receive labels. `items` must be pre-ranked for
   * `"auto"` mode (extremity for scatter, size descending for bubble).
   */
  public selectCandidates<T>(
    items: T[],
    mode: LabelConfig["points"],
    max: number,
    nameOf: (item: T) => string,
  ): LabelSelection<T> {
    if (mode === "none") {
      return { selected: [], unknownNames: [] };
    }
    if (mode === "all") {
      return { selected: [...items], unknownNames: [] };
    }
    if (mode === "auto") {
      return { selected: items.slice(0, max), unknownNames: [] };
    }

    const wanted = new Set(mode);
    const selected = items.filter((item) => wanted.has(nameOf(item)));
    const found = new Set(selected.map((item) => nameOf(item)));
    const unknownNames = mode.filter((name) => !found.has(name));
    return { selected, unknownNames };
  }

  /** Greedy placement in candidate order; returns only the labels that fit. */
  public place(candidates: LabelCandidate[]): PlacedLabel[] {
    const placed: PlacedLabel[] = [];

    // fixed sides first, so the other labels stay clear of them
    for (const candidate of candidates) {
      if (candidate.side === undefined) {
        continue;
      }
      const box = this.anchorBox(candidate, candidate.side);
      this.texts.register(this.bounds(box.x, box.y, candidate.width, candidate.height));
      placed.push({ candidate, x: box.x, y: box.y, anchor: candidate.side });
    }

    for (const candidate of candidates) {
      if (candidate.side !== undefined) {
        continue;
      }
      const label = this.freePlace(candidate) ?? (this.onMarks ? this.placeOnMarks(candidate) : null);
      if (label !== null) {
        this.texts.register(this.bounds(label.x, label.y, candidate.width, candidate.height));
        placed.push(label);
      }
    }

    return placed;
  }

  /** The first side where the label is inside the frame and on no text and no mark. */
  private freePlace(candidate: LabelCandidate): PlacedLabel | null {
    for (const anchor of ANCHORS) {
      const box = this.anchorBox(candidate, anchor);
      if (!this.insideFrame(box.x, box.y, candidate.width, candidate.height)) {
        continue;
      }
      const bounds = this.bounds(box.x, box.y, candidate.width, candidate.height);
      if (this.texts.hasCollision(bounds) || this.manager.hasCollision(bounds)) {
        continue;
      }
      return { candidate, x: box.x, y: box.y, anchor };
    }
    return null;
  }

  /** The side where the least of the label stands on marks, inside the frame and on no text. */
  private placeOnMarks(candidate: LabelCandidate): PlacedLabel | null {
    let best: PlacedLabel | null = null;
    let bestCovered = Infinity;
    for (const anchor of ANCHORS) {
      const box = this.anchorBox(candidate, anchor);
      if (!this.insideFrame(box.x, box.y, candidate.width, candidate.height)) {
        continue;
      }
      if (this.texts.hasCollision(this.bounds(box.x, box.y, candidate.width, candidate.height))) {
        continue;
      }
      const covered = this.coveredByMarks(box.x, box.y, candidate.width, candidate.height);
      if (covered < bestCovered) {
        best = { candidate, x: box.x, y: box.y, anchor };
        bestCovered = covered;
      }
    }
    return best;
  }

  private coveredByMarks(x: number, y: number, width: number, height: number): number {
    let covered = 0;
    for (const mark of this.markBoxes) {
      const w = Math.min(x + width, mark.x + mark.width) - Math.max(x, mark.x);
      const h = Math.min(y + height, mark.y + mark.height) - Math.max(y, mark.y);
      if (w > 0 && h > 0) {
        covered += w * h;
      }
    }
    return covered;
  }

  private anchorBox(c: LabelCandidate, anchor: LabelAnchor): { x: number; y: number } {
    const offset = c.r + this.gapPx;
    const diagonal = c.r * DIAGONAL + this.gapPx * 0.5;

    switch (anchor) {
      case "n":
        return { x: c.cx - c.width / 2, y: c.cy - offset - c.height };
      case "ne":
        return { x: c.cx + diagonal, y: c.cy - diagonal - c.height };
      case "e":
        return { x: c.cx + offset, y: c.cy - c.height / 2 };
      case "se":
        return { x: c.cx + diagonal, y: c.cy + diagonal };
      case "s":
        return { x: c.cx - c.width / 2, y: c.cy + offset };
      case "sw":
        return { x: c.cx - diagonal - c.width, y: c.cy + diagonal };
      case "w":
        return { x: c.cx - offset - c.width, y: c.cy - c.height / 2 };
      case "nw":
        return { x: c.cx - diagonal - c.width, y: c.cy - diagonal - c.height };
    }
  }

  private insideFrame(x: number, y: number, width: number, height: number): boolean {
    return (
      x >= this.frame.x &&
      y >= this.frame.y &&
      x + width <= this.frame.x + this.frame.width &&
      y + height <= this.frame.y + this.frame.height
    );
  }

  private bounds(x: number, y: number, width: number, height: number): LabelBounds {
    return { x, y, width, height, pointIndex: 0, preferredHook: HookLocation.Center };
  }
}
