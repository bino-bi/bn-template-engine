import { G } from "@svgdotjs/svg.js";
import CalculateSize from "calculate-size";
import { MarkTreatment } from "./SeriesPalette";
import { XYChartStyle } from "./model/XYChartStyle";

/** One legend row: a color swatch plus its label. */
export interface LegendEntry {
  label: string;
  treatment: MarkTreatment;
  /** Fill of the swatch when the chart draws this treatment with a pattern (hatched forecast bubbles). */
  fill?: string;
}

/** The legend content of one chart (rendered once, chart-level). */
export interface LegendModel {
  /** Size-measure caption lines, bubble only (e.g. `["Net sales", "in mEUR"]`). */
  sizeCaption: string[];
  /** Heading above the series entries (e.g. "Product lines"). */
  title: string | null;
  /** Scenario-family entries when a comparison overlay is active (e.g. PY/AC). */
  compareEntries: LegendEntry[];
  /** Series entries, ordered by the series level's `*Index`. */
  entries: LegendEntry[];
}

/** Measured legend footprint. */
export interface LegendSize {
  width: number;
  height: number;
}

/**
 * Series-color legend + bubble-size caption for the XY charts
 * (IBCS requires a legend explaining colors - and, for bubbles, size).
 * Positioned by the orchestrator: right column (default) or bottom row.
 */
export class XYLegend {
  constructor(private readonly styles: XYChartStyle) {}

  private get em(): number {
    return this.styles.fontStyles.size;
  }

  private get rowHeight(): number {
    return this.em * 1.5;
  }

  private get swatchSize(): number {
    return this.styles.scaleFactors.legendSwatch * this.em;
  }

  private textWidth(text: string, bold: boolean = false): number {
    const width = CalculateSize(text, {
      font: this.fontFamily(),
      fontSize: this.styles.fontStyles.size + "px",
      fontWeight: bold ? "bold" : "normal",
    }).width;
    // calculate-size needs a live DOM; fall back to an estimate in test environments.
    return Number.isFinite(width) && width > 0 ? width : text.length * 0.6 * this.em;
  }

  private rows(model: LegendModel): { text: string; bold: boolean; treatment: MarkTreatment | null; fill?: string }[] {
    const rows: { text: string; bold: boolean; treatment: MarkTreatment | null; fill?: string }[] = [];

    model.sizeCaption.forEach((line, index) => {
      rows.push({ text: line, bold: index === 0, treatment: null });
    });
    if (model.title !== null && model.title !== "") {
      rows.push({ text: model.title, bold: true, treatment: null });
    }
    for (const entry of [...model.compareEntries, ...model.entries]) {
      rows.push({ text: entry.label, bold: false, treatment: entry.treatment, fill: entry.fill });
    }

    return rows;
  }

  /** Footprint of the legend for layout reservation. */
  public measure(model: LegendModel, position: "right" | "bottom"): LegendSize {
    const rows = this.rows(model);
    if (rows.length === 0) {
      return { width: 0, height: 0 };
    }

    const swatchSpan = this.swatchSize + 0.4 * this.em;

    if (position === "bottom") {
      let width = 0;
      for (const row of rows) {
        width += (row.treatment !== null ? swatchSpan : 0) + this.textWidth(row.text, row.bold) + 1.5 * this.em;
      }
      return { width, height: this.rowHeight };
    }

    let width = 0;
    for (const row of rows) {
      width = Math.max(width, (row.treatment !== null ? swatchSpan : 0) + this.textWidth(row.text, row.bold));
    }
    return { width, height: rows.length * this.rowHeight };
  }

  /** Draws the legend with its top-left corner at `x`/`y`. */
  public draw(group: G, model: LegendModel, x: number, y: number, position: "right" | "bottom"): void {
    const rows = this.rows(model);
    const swatchSpan = this.swatchSize + 0.4 * this.em;

    let cursorX = x;
    let cursorY = y;

    for (const row of rows) {
      let textX = cursorX;

      if (row.treatment !== null) {
        const swatch = group
          .circle(this.swatchSize)
          .move(cursorX, cursorY + (this.rowHeight - this.swatchSize) / 2)
          .fill(row.fill ?? (row.treatment.hatch ? "#ffffff" : row.treatment.fill))
          .attr("fill-opacity", row.treatment.fillOpacity ?? 1)
          .stroke({
            color: row.treatment.stroke === "#ffffff" ? row.treatment.fill : row.treatment.stroke,
            width: row.treatment.strokeWidth,
          });
        if (row.treatment.dasharray !== undefined) {
          swatch.attr("stroke-dasharray", row.treatment.dasharray);
        }
        textX += swatchSpan;
      }

      group
        .text(row.text)
        .font({
          size: this.styles.fontStyles.size,
          weight: row.bold ? "bold" : "normal",
          anchor: "start",
        })
        .fill(this.styles.fontStyles.color)
        .attr({ x: textX, y: cursorY + this.rowHeight / 2 + this.em * 0.35, "font-family": this.fontFamily() });

      if (position === "bottom") {
        cursorX = textX + this.textWidth(row.text, row.bold) + 1.5 * this.em;
      } else {
        cursorY += this.rowHeight;
      }
    }
  }

  private fontFamily(): string {
    return this.styles.fontStyles.font.replace(/^[\d.]+px\s*/, "");
  }
}
