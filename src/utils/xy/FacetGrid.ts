/** Axis-aligned rectangle in pixel coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Small-multiple panel layout: divides a drawing area into equal panels,
 * wrapping row-major at `columns`. Axis tick labels render on the outer
 * edges only (IBCS 10F/10G style) - the `isOuterLeft`/`isOuterBottom`
 * flags tell the renderer which panels carry them.
 */
export class FacetGrid {
  public readonly columns: number;
  public readonly rows: number;

  constructor(
    public readonly count: number,
    columns: number | undefined,
    private readonly drawingRect: Rect,
    private readonly panelGapPx: number,
  ) {
    this.columns = Math.max(1, Math.min(columns ?? count, count));
    this.rows = Math.max(1, Math.ceil(count / this.columns));
  }

  /** Rectangle of the i-th panel (row-major order). */
  public panelRect(index: number): Rect {
    const col = index % this.columns;
    const row = Math.floor(index / this.columns);
    const width = (this.drawingRect.width - (this.columns - 1) * this.panelGapPx) / this.columns;
    const height = (this.drawingRect.height - (this.rows - 1) * this.panelGapPx) / this.rows;

    return {
      x: this.drawingRect.x + col * (width + this.panelGapPx),
      y: this.drawingRect.y + row * (height + this.panelGapPx),
      width,
      height,
    };
  }

  /** True when the panel sits in the leftmost column (carries y tick labels). */
  public isOuterLeft(index: number): boolean {
    return index % this.columns === 0;
  }

  /** True when a panel stands left of this one in its row. */
  public hasLeftNeighbour(index: number): boolean {
    return index % this.columns > 0;
  }

  /** True when a panel stands right of this one in its row. */
  public hasRightNeighbour(index: number): boolean {
    return index % this.columns < this.columns - 1 && index + 1 < this.count;
  }

  /** True when no panel renders below this one (carries x tick labels). */
  public isOuterBottom(index: number): boolean {
    return index + this.columns >= this.count;
  }
}
