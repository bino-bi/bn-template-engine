import { G } from "@svgdotjs/svg.js";
import CalculateSize from "calculate-size";
import { Rect } from "./FacetGrid";
import { formatXYValue } from "./formatXYValue";
import { NumericScale } from "./NumericScale";
import { HighlightRange } from "./model/AxisConfig";
import { XYChartStyle } from "./model/XYChartStyle";
import { strokeWidthPx } from "../scaling";
import { BASELINE_ATTRIBUTE } from "../layoutState/baseline";

/** Tick rendering configuration for one panel. */
export interface TickRenderConfig {
  ticksX: number[];
  ticksY: number[];
  xDecimals: number;
  yDecimals: number;
  /** The axis holds a relative variance: its ticks are fractions and print in percent. */
  xPercent?: boolean;
  yPercent?: boolean;
  /** Outer-edge panels only (facet grids label outer edges, 10F/10G style). */
  showXLabels: boolean;
  showYLabels: boolean;
  /** A panel stands left (right) of this one: a label on that edge of the x axis stays inside the panel. */
  panelLeft?: boolean;
  panelRight?: boolean;
}

/**
 * Per-panel plot frame for the XY charts: highlight bands, gridlines,
 * reference lines, the frame rectangle, tick labels, and the panel title.
 *
 * Style roles are taken from the `axisStyles` scenario group:
 * `ac` = frame + tick labels, `pp` = gridlines, `fc` = reference lines
 * and iso-curves, `pl` = highlight band fill.
 */
export class XYFrame {
  constructor(
    private readonly xScale: NumericScale,
    private readonly yScale: NumericScale,
    private readonly rect: Rect,
    private readonly styles: XYChartStyle,
  ) {}

  private get em(): number {
    return this.styles.fontStyles.size;
  }

  private fontFamily(): string {
    return this.styles.fontStyles.font.replace(/^[\d.]+px\s*/, "");
  }

  private textWidth(text: string): number {
    const width = CalculateSize(text, {
      font: this.fontFamily(),
      fontSize: this.styles.fontStyles.size + "px",
      fontWeight: "normal",
    }).width;
    // calculate-size needs a live DOM; fall back to an estimate in test environments.
    return Number.isFinite(width) && width > 0 ? width : text.length * 0.6 * this.em;
  }

  /** Shaded bands behind everything; open ends run to the domain edge. */
  public drawBands(group: G, xHighlight?: HighlightRange, yHighlight?: HighlightRange): void {
    const fill = this.styles.axisStyles.pl.fill;

    if (xHighlight !== undefined && (xHighlight.from !== undefined || xHighlight.to !== undefined)) {
      const from = this.xScale.scale(xHighlight.from ?? this.xScale.domainMin);
      const to = this.xScale.scale(xHighlight.to ?? this.xScale.domainMax);
      group
        .rect(Math.abs(to - from), this.rect.height)
        .move(Math.min(from, to), this.rect.y)
        .fill(fill);
    }

    if (yHighlight !== undefined && (yHighlight.from !== undefined || yHighlight.to !== undefined)) {
      const from = this.yScale.scale(yHighlight.from ?? this.yScale.domainMin);
      const to = this.yScale.scale(yHighlight.to ?? this.yScale.domainMax);
      group
        .rect(this.rect.width, Math.abs(from - to))
        .move(this.rect.x, Math.min(from, to))
        .fill(fill);
    }
  }

  /** Horizontal gridlines at the y ticks; vertical ones only when `ticksX` is given. */
  public drawGrid(group: G, ticksY: number[], ticksX?: number[]): void {
    const stroke = {
      color: this.styles.axisStyles.pp.stroke,
      width: strokeWidthPx(this.styles.scaleFactors.gridLineWidth, this.em),
    };

    for (const tick of ticksY) {
      const y = this.yScale.scale(tick);
      group.line(this.rect.x, y, this.rect.x + this.rect.width, y).stroke(stroke);
    }

    if (ticksX !== undefined) {
      for (const tick of ticksX) {
        const x = this.xScale.scale(tick);
        group.line(x, this.rect.y, x, this.rect.y + this.rect.height).stroke(stroke);
      }
    }
  }

  /** Thin reference lines at the given axis values (10A quadrant crosshair). */
  public drawRefLines(group: G, xRef?: number, yRef?: number): void {
    const stroke = {
      color: this.styles.axisStyles.fc.stroke,
      width: strokeWidthPx(this.styles.scaleFactors.refLineWidth, this.em),
    };

    if (xRef !== undefined) {
      const x = this.xScale.scale(xRef);
      group.line(x, this.rect.y, x, this.rect.y + this.rect.height).stroke(stroke);
    }

    if (yRef !== undefined) {
      const y = this.yScale.scale(yRef);
      group.line(this.rect.x, y, this.rect.x + this.rect.width, y).stroke(stroke);
    }
  }

  /** The four-sided thin plot frame (as in the IBCS template images). */
  public drawFrame(group: G): void {
    group
      .rect(this.rect.width, this.rect.height)
      .move(this.rect.x, this.rect.y)
      .fill("none")
      .stroke({
        color: this.styles.axisStyles.ac.stroke,
        width: strokeWidthPx(this.styles.scaleFactors.gridLineWidth, this.em),
      })
      .attr(BASELINE_ATTRIBUTE, "frame");
  }

  /** Tick labels along the outer edges (no tick marks - template style). */
  public drawTickLabels(group: G, config: TickRenderConfig): void {
    const gap = this.styles.scaleFactors.axisTickLength * this.em;
    const font = { size: this.styles.fontStyles.size, anchor: "start" as string };
    const family = this.fontFamily();
    const color = this.styles.fontStyles.color;

    if (config.showXLabels) {
      const labels = config.ticksX.map((tick) => {
        const x = this.xScale.scale(tick);
        const text = formatXYValue(tick, config.xDecimals, this.styles.locale, config.xPercent);
        const width = this.textWidth(text);
        // centred on the edge it would run into the label of the next panel
        const atLeft = config.panelLeft === true && Math.abs(x - this.rect.x) < 0.5;
        const atRight = config.panelRight === true && Math.abs(x - this.rect.x - this.rect.width) < 0.5;
        const anchor = atLeft ? "start" : atRight ? "end" : "middle";
        const left = atLeft ? x : atRight ? x - width : x - width / 2;
        return { x, text, anchor, left, right: left + width };
      });

      // No label runs into another one: the two ends of the axis come first, then the others in their order.
      const minGap = 0.3 * this.em;
      const kept: typeof labels = [];
      const ordered = [labels[0], labels[labels.length - 1], ...labels.slice(1, -1)].filter(
        (label, index, list) => label !== undefined && list.indexOf(label) === index,
      );
      for (const label of ordered) {
        if (kept.every((other) => label.left >= other.right + minGap || label.right <= other.left - minGap)) {
          kept.push(label);
        }
      }

      for (const label of kept) {
        group
          .text(label.text)
          .font({ ...font, anchor: label.anchor })
          .fill(color)
          .attr({ x: label.x, y: this.rect.y + this.rect.height + gap + this.em * 0.8, "font-family": family });
      }
    }

    if (config.showYLabels) {
      for (const tick of config.ticksY) {
        const y = this.yScale.scale(tick);
        group
          .text(formatXYValue(tick, config.yDecimals, this.styles.locale, config.yPercent))
          .font({ ...font, anchor: "end" })
          .fill(color)
          .attr({ x: this.rect.x - gap, y: y + this.em * 0.35, "font-family": family });
      }
    }
  }

  /** Where the baseline of the panel title starts. */
  public panelTitleOrigin(): { x: number; y: number } {
    return { x: this.rect.x + 0.5 * this.em, y: this.rect.y + 1.2 * this.em };
  }

  /** Facet panel title, top-left inside the panel, bold (10F "Europe"/"RoW"). */
  public drawPanelTitle(group: G, title: string): void {
    if (title === "") {
      return;
    }
    const origin = this.panelTitleOrigin();
    group
      .text(title)
      .font({ size: this.styles.fontStyles.size, weight: "bold", anchor: "start" })
      .fill(this.styles.fontStyles.color)
      .attr({ x: origin.x, y: origin.y, "font-family": this.fontFamily() });
  }
}
