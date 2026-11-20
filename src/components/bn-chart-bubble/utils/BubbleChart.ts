import { Container, G, Shape, Svg, Text } from "@svgdotjs/svg.js";
import { dataPointAttributes } from "../../../utils/layoutState/dataPoint";
import { xyPointKey } from "../../../utils/xy/pointKey";
import CalculateSize from "calculate-size";
import { AlaSQLDatabase } from "../../../context/scopedDb";
import { errorText } from "../../../utils/queryError";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { getContrastTextColor } from "../../../utils/stackColors";
import { FacetGrid, Rect } from "../../../utils/xy/FacetGrid";
import { formatXYValue } from "../../../utils/xy/formatXYValue";
import { NumericScale } from "../../../utils/xy/NumericScale";
import {
  axisDecimals,
  axisLabel,
  axisTitleLines,
  AxisTitleLine,
  isTitleBeside,
  legendOffset,
} from "../../../utils/xy/AxisTitles";
import { LabelReport } from "../../../utils/xy/LabelReport";
import { LabelCandidate, PointLabeler } from "../../../utils/xy/PointLabeler";
import {
  isOutlinedSeries,
  markTreatment,
  MarkTreatment,
  mixHex,
  outlineTreatment,
  pinSeries,
  resolveSeriesColor,
  shade,
} from "../../../utils/xy/SeriesPalette";
import { RadiusScale } from "../../../utils/xy/RadiusScale";
import { axisInValueUnits, isRelativeMeasure, resolveMeasure } from "../../../utils/xy/VarianceMeasure";
import { XYFrame } from "../../../utils/xy/XYFrame";
import { LegendEntry, LegendModel, XYLegend } from "../../../utils/xy/XYLegend";
import {
  AxisConfig,
  FacetConfig,
  LabelConfig,
  labelSide,
  LegendConfig,
  ShareConfig,
  SizeConfig,
} from "../../../utils/xy/model/AxisConfig";
import {
  GroupLevel,
  PointLevel,
  ResolvedXYData,
  resolveXYData,
  XYChartDataRowAdapter,
  XYPoint,
  XYWarningRecord,
} from "../../../utils/xy/model/XYChartDataRow";
import { XYChartStyle } from "../../../utils/xy/model/XYChartStyle";

/** Prepared configuration handed to the bubble orchestrator by the inner element. */
export interface BubbleChartConfig {
  chartTitle: string;
  x: AxisConfig;
  y: AxisConfig;
  size: SizeConfig;
  share: ShareConfig | null;
  /** Comparison scenario family (`pp`/`fc`/`pl`/`ac`), or `null`. */
  compareFamily: string | null;
  labels: LabelConfig;
  legend: LegendConfig;
  facet: FacetConfig | null;
  pointLevel: PointLevel;
  seriesLevel: GroupLevel | null;
  /** Plot aspect ratio as width/height (16:9 → 16/9). */
  aspect: number;
  limit: number;
  /**
   * Cross-chart size scaling (`bn-scaling-group`): area in px² per data
   * unit, already multiplied by the squared auto-fit factor. 0 = local
   * vMax-normalized sizing.
   */
  sizeAreaPerUnit: number;
}

interface PanelContext {
  rect: Rect;
  xScale: NumericScale;
  yScale: NumericScale;
  frame: XYFrame;
}

interface BubbleMark {
  point: XYPoint;
  cx: number;
  cy: number;
  r: number;
  seriesIndex: number;
  hue: string;
  treatment: MarkTreatment;
}

/**
 * SVG orchestrator for `bn-chart-bubble` (IBCS template C10).
 *
 * Bubble **area** is proportional to the size measure. Marks compose the
 * series hue with the scenario treatment from the rule set; an optional
 * comparison scenario renders behind the primary set (10D), `share` draws
 * a pie sector from 12 o'clock (10E). The SVG is built on a detached
 * `Svg` root and emitted via `toString()`.
 */
export class BubbleChart {
  private data: ResolvedXYData;
  private warnings: XYWarningRecord[] = [];
  /** Text of the query that failed. The component reports it as ERR_sql. */
  private queryError: string | undefined;
  private canvasHeight: number = 0;
  private i18nMap: Map<string, string> = new Map();
  private hatchPatterns: Set<number> = new Set();
  private scaleOverflowCount: number = 0;
  private svgRoot: Svg | null = null;
  private labelReport: LabelReport = new LabelReport();

  constructor(
    private readonly ruleSet: IBCSRuleSet,
    db: AlaSQLDatabase,
    fromExpr: string,
    private readonly config: BubbleChartConfig,
    public readonly styles: XYChartStyle,
    private readonly availableWidth: number,
  ) {
    // a relative variance axis is written in percent, its values are fractions
    this.config = { ...config, x: axisInValueUnits(config.x), y: axisInValueUnits(config.y) };

    const adapter = new XYChartDataRowAdapter();
    let rawRows: Record<string, unknown>[] = [];
    try {
      if (fromExpr !== "") rawRows = db.exec<Record<string, unknown>[]>(`SELECT * FROM ${fromExpr}`);
    } catch (e) {
      this.queryError = errorText(e);
    }
    const rows = (rawRows ?? []).map((row) => adapter.adapt(row));

    this.data = resolveXYData(rows, {
      pointLevel: config.pointLevel,
      seriesLevel: config.seriesLevel,
      facetLevel: config.facet !== null ? (config.facet.level === "rowgroup" ? "rowGroup" : "category") : null,
      measures: {
        x: resolveMeasure(config.x.measure) ?? { kind: "scenario", slot: "ac1" },
        y: resolveMeasure(config.y.measure) ?? { kind: "scenario", slot: "ac2" },
        size: resolveMeasure(config.size.measure) ?? { kind: "scenario", slot: "ac3" },
        share: config.share !== null ? (resolveMeasure(config.share.measure) ?? undefined) : undefined,
      },
      compareFamily: config.compareFamily,
      domains: {
        x: { min: this.config.x.min, max: this.config.x.max },
        y: { min: this.config.y.min, max: this.config.y.max },
      },
      limit: config.limit,
      limitBy: "size",
    });
    this.data.series = pinSeries(this.data.series, styles.seriesNames);
    this.warnings.push(...this.data.warnings);
  }

  private get em(): number {
    return this.styles.fontStyles.size;
  }

  /** The x axis holds a relative variance and is labelled in percent. */
  private get xPercent(): boolean {
    return isRelativeMeasure(this.config.x.measure);
  }

  /** The y axis holds a relative variance and is labelled in percent. */
  private get yPercent(): boolean {
    return isRelativeMeasure(this.config.y.measure);
  }

  /** The bubble size is a relative variance and its value label is in percent. */
  private get sizePercent(): boolean {
    return isRelativeMeasure(this.config.size.measure);
  }

  private fontFamily(): string {
    return this.styles.fontStyles.font.replace(/^[\d.]+px\s*/, "");
  }

  private textWidth(text: string, bold: boolean = false): number {
    const width = CalculateSize(text, {
      // the family only: with the size in front the value is no font family and the text is measured in the font of the page
      font: this.fontFamily(),
      fontSize: this.styles.fontStyles.size + "px",
      fontWeight: bold ? "bold" : "normal",
    }).width;
    // calculate-size needs a live DOM; fall back to an estimate in test environments.
    return Number.isFinite(width) && width > 0 ? width : text.length * 0.6 * this.em;
  }

  private drawText(
    group: G,
    text: string,
    x: number,
    y: number,
    options: { anchor?: string; bold?: boolean; color?: string } = {},
  ): Text {
    return group
      .text(text)
      .font({
        size: this.styles.fontStyles.size,
        weight: options.bold ? "bold" : "normal",
        anchor: options.anchor ?? "start",
      })
      .fill(options.color ?? this.styles.fontStyles.color)
      .attr({ x, y, "font-family": this.fontFamily() });
  }

  public hasNoData(): boolean {
    return this.data.totalPoints === 0;
  }

  /** Warnings collected during data resolution and drawing (§8 codes). */
  public getWarnings(): XYWarningRecord[] {
    return this.warnings;
  }

  public getQueryError(): string | undefined {
    return this.queryError;
  }

  public getAllocatedCanvasWidth(): number {
    return this.availableWidth;
  }

  public getAllocatedCanvasHeight(): number {
    return this.canvasHeight;
  }

  public setI18n(i18n: Map<string, string>): void {
    this.i18nMap = i18n;
  }

  private addWarningOnce(code: string, data: Record<string, string>): void {
    if (!this.warnings.some((w) => w.code === code)) {
      this.warnings.push({ code, data });
    }
  }

  /** ColorIndex of the primary scenario family (variance axes → 10). */
  private primaryColorIndex(): number {
    const ref = resolveMeasure(this.config.size.measure);
    if (ref === null || ref.kind === "variance") {
      return 10;
    }
    return this.ruleSet.getScenarioColorIndex(ref.slot);
  }

  private compareColorIndex(): number {
    return this.ruleSet.getScenarioColorIndex(`${this.config.compareFamily}1`);
  }

  private seriesHue(seriesIndex: number): string {
    const { color, overflowed } = resolveSeriesColor(seriesIndex, this.styles.seriesColors);
    if (overflowed) {
      this.addWarningOnce("xy-series-overflow", {});
    }
    return color;
  }

  /** Scenario display name of a family (e.g. "PY"), from the merged rule set. */
  private familyDisplayName(family: string): string {
    return this.ruleSet.getScenario(`${family}1`).group;
  }

  private legendModel(): LegendModel {
    const sizeCaption: string[] = [];
    const sizeLabel = this.config.size.label ?? this.i18nMap.get("legend.size") ?? "";
    if (sizeLabel !== "") {
      sizeCaption.push(sizeLabel);
      if (this.config.size.unit !== undefined && this.config.size.unit !== "") {
        sizeCaption.push(`${this.i18nMap.get("axis.in") || "in"} ${this.config.size.unit}`);
      }
    }

    const compareEntries: LegendEntry[] = [];
    if (this.config.compareFamily !== null) {
      const primaryRef = resolveMeasure(this.config.size.measure);
      const primaryFamily =
        primaryRef !== null && primaryRef.kind === "scenario" ? primaryRef.slot.replace(/\d+$/, "") : "ac";
      compareEntries.push(
        this.legendEntry(this.familyDisplayName(this.config.compareFamily), this.compareColorIndex(), 0),
      );
      compareEntries.push(this.legendEntry(this.familyDisplayName(primaryFamily), this.primaryColorIndex(), 0));
    }

    const excluded = this.config.legend.exclude ?? [];
    const entries: LegendEntry[] = this.data.series
      .filter((series) => !excluded.includes(series.key))
      .map((series) =>
        this.legendEntry(
          series.key === "" ? (this.ruleSet.getScenario("").name ?? "Series") : series.key,
          this.primaryColorIndex(),
          series.index,
        ),
      );

    return {
      sizeCaption,
      title: this.i18nMap.get("legend.title") || null,
      compareEntries,
      entries,
    };
  }

  /** A legend row whose swatch has the fill of the bubbles it stands for: hatched for forecast. */
  private legendEntry(label: string, colorIndex: number, seriesIndex: number): LegendEntry {
    const hue = this.seriesHue(seriesIndex);
    const treatment = this.bubbleTreatment(colorIndex, seriesIndex, hue);

    return { label, treatment, fill: this.treatmentFill(treatment, seriesIndex, hue) };
  }

  /** The look of a bubble: the scenario treatment, or the outline when the style asks for it and the scenario is a filled one. */
  private bubbleTreatment(colorIndex: number, seriesIndex: number, hue: string): MarkTreatment {
    if (isOutlinedSeries(this.styles.seriesFills, seriesIndex) && colorIndex !== 30 && colorIndex !== 50) {
      return outlineTreatment(hue, "bubble");
    }
    return markTreatment(colorIndex, hue, "bubble", this.styles.markStyles.stroke, this.styles.markStyles.opacity);
  }

  public toString(): string {
    const container = new Svg();
    this.draw(container);
    container.id("drawCanvas");
    container.width(this.getAllocatedCanvasWidth());
    container.height(this.getAllocatedCanvasHeight());
    container.attr("overflow", "visible");
    return container.svg();
  }

  /** Axis title in the IBCS "Label in Unit" form. */
  private axisTitle(axis: AxisConfig, inWord: string): string {
    const label = axisLabel(axis);
    if (label === "") {
      return "";
    }
    if (axis.unit === undefined || axis.unit === "") {
      return label;
    }
    return `${label} ${inWord} ${axis.unit}`;
  }

  private draw(container: Svg): void {
    this.warnings = this.data.warnings.slice();
    this.hatchPatterns.clear();
    this.scaleOverflowCount = 0;
    this.labelReport = new LabelReport();
    this.svgRoot = container;
    const em = this.em;
    const padding = this.styles.padding;
    const inWord = this.i18nMap.get("axis.in") || "in";

    const root = container.group();
    const legend = new XYLegend(this.styles);
    const legendModel = this.legendModel();
    const showLegend =
      this.config.legend.show && (legendModel.entries.length > 0 || legendModel.sizeCaption.length > 0);
    const legendSize = showLegend
      ? legend.measure(legendModel, this.config.legend.position === "bottom" ? "bottom" : "right")
      : { width: 0, height: 0 };

    const rightReserve = this.config.legend.position === "right" && showLegend ? legendSize.width + em : 0;

    const titleH = this.config.chartTitle !== "" ? 1.6 * em : 0;
    const yTitleText = this.axisTitle(this.config.y, inWord);
    const xTitleText = this.axisTitle(this.config.x, inWord);
    // A title beside the end of its axis takes room left of the tick labels (y) or right of the plot (x).
    const yBeside = isTitleBeside(this.config.y);
    const xBeside = isTitleBeside(this.config.x);
    const yLines = axisTitleLines(this.config.y, inWord);
    const xLines = axisTitleLines(this.config.x, inWord);
    const linesWidth = (lines: AxisTitleLine[]): number =>
      Math.max(0, ...lines.map((line) => this.textWidth(line.text, line.bold)));
    const lineH = 1.15 * em;
    const yTitleW = yBeside ? linesWidth(yLines) + 0.5 * em : 0;
    const xTitleW = xBeside ? linesWidth(xLines) : 0;
    const yTitleH = yTitleText !== "" ? (yBeside ? 1.2 : 1.4) * em : 0.4 * em;
    const xAxisH = 1.4 * em + (xBeside ? (xLines.length - 1) * lineH : xTitleText !== "" ? 1.3 * em : 0);

    let axisLeftW = 3 * em;
    let drawing: Rect = { x: 0, y: 0, width: 0, height: 0 };
    let grid: FacetGrid;
    let ticksY: number[] = [];

    const facetCount = Math.max(1, this.data.facets.length);
    const columns = this.config.facet?.columns;

    const xDomain = NumericScale.domain(this.data.extents?.xMin ?? 0, this.data.extents?.xMax ?? 1, {
      min: this.config.x.min,
      max: this.config.x.max,
    });
    const yDomain = NumericScale.domain(this.data.extents?.yMin ?? 0, this.data.extents?.yMax ?? 1, {
      min: this.config.y.min,
      max: this.config.y.max,
    });

    // The last tick label is centred on the end of the x axis: a title beside it starts right of that label.
    // The ticks are not known before the plot has its width, so the widest of a usual set stands in.
    const likelyTicksX = new NumericScale(xDomain[0], xDomain[1], 0, 1).ticks(6, this.config.x.step);
    const likelyLabel = formatXYValue(
      likelyTicksX[likelyTicksX.length - 1],
      axisDecimals(this.config.x, likelyTicksX, this.xPercent),
      this.styles.locale,
      this.xPercent,
    );
    const xTitleGap = xBeside ? Math.max(1.4 * em, this.textWidth(likelyLabel) / 2 + 0.7 * em) : 0;

    for (let pass = 0; pass < 2; pass++) {
      const drawingW = Math.max(
        10,
        this.availableWidth - padding.left - padding.right - axisLeftW - Math.max(rightReserve, xTitleGap + xTitleW),
      );
      const drawingH = drawingW / this.config.aspect;
      drawing = {
        x: padding.left + axisLeftW,
        y: padding.top + titleH + yTitleH,
        width: drawingW,
        height: drawingH,
      };
      grid = new FacetGrid(facetCount, columns, drawing, this.styles.scaleFactors.panelGap * em);

      const panelH = grid.panelRect(0).height;
      const targetY = Math.max(4, Math.min(8, Math.round(panelH / (4 * em))));
      const yScale = new NumericScale(yDomain[0], yDomain[1], panelH, 0);
      ticksY = yScale.ticks(targetY, this.config.y.step);

      const yDecimals = axisDecimals(this.config.y, ticksY, this.yPercent);
      const maxTickW = Math.max(
        ...ticksY.map((tick) => this.textWidth(formatXYValue(tick, yDecimals, this.styles.locale, this.yPercent))),
        em,
      );
      axisLeftW = maxTickW + this.styles.scaleFactors.axisTickLength * em + 0.4 * em + yTitleW;
    }

    let panels = this.buildPanels(grid!, xDomain, yDomain);
    const ticksX = panels[0].xScale.ticks(
      Math.max(3, Math.min(8, Math.round(panels[0].rect.width / (7 * em)))),
      this.config.x.step,
    );
    const xDecimals = axisDecimals(this.config.x, ticksX, this.xPercent);
    const yDecimals = axisDecimals(this.config.y, ticksY, this.yPercent);

    const radiusScale =
      this.config.sizeAreaPerUnit > 0
        ? RadiusScale.grouped(this.config.sizeAreaPerUnit)
        : RadiusScale.local(
            this.data.extents?.sizeMax ?? 0,
            this.styles.scaleFactors.bubbleMaxRadius * em,
            this.styles.scaleFactors.bubbleMinRadius * em,
          );

    // A bubble may hang out of the plot. The chart is as high as its bubbles, so none is cut at its edge.
    let reach = this.bubbleReach(panels, radiusScale);
    // at the top a bubble stays below the chart title
    const shiftDown = Math.max(0, padding.top + titleH - reach.top);
    if (shiftDown > 0) {
      drawing = { ...drawing, y: drawing.y + shiftDown };
      grid = new FacetGrid(facetCount, columns, drawing, this.styles.scaleFactors.panelGap * em);
      panels = this.buildPanels(grid, xDomain, yDomain);
      reach = { top: reach.top + shiftDown, bottom: reach.bottom + shiftDown };
    }
    this.canvasHeight =
      Math.max(drawing.y + drawing.height + xAxisH, reach.bottom) +
      (this.config.legend.position === "bottom" && showLegend ? legendSize.height + em : 0) +
      padding.bottom;

    if (this.config.chartTitle !== "") {
      this.drawText(root, this.config.chartTitle, padding.left, padding.top + em, { bold: true });
    }

    if (yBeside) {
      // right-aligned left of the tick labels: the first line above the top of the axis, the others below it
      const x = padding.left + yTitleW - 0.5 * em;
      yLines.forEach((line, index) => {
        this.drawText(root, line.text, x, drawing.y - 0.3 * em + index * lineH, { anchor: "end", bold: line.bold });
      });
    } else if (yTitleText !== "") {
      this.drawAxisTitleText(root, this.config.y, inWord, padding.left, drawing.y - 0.6 * em, "start");
    }

    if (this.data.facets.length === 0) {
      this.drawPanel(
        root,
        panels[0],
        { key: "", points: [] },
        radiusScale,
        ticksX,
        ticksY,
        xDecimals,
        yDecimals,
        true,
        true,
      );
    } else {
      this.data.facets.forEach((facet, index) => {
        this.drawPanel(
          root,
          panels[index],
          facet,
          radiusScale,
          ticksX,
          ticksY,
          xDecimals,
          yDecimals,
          grid!.isOuterLeft(index),
          grid!.isOuterBottom(index),
          this.data.facets.length > 1 ? facet.key : "",
          // a panel above the last row shows no x labels: nothing to run into
          grid!.hasLeftNeighbour(index) && grid!.isOuterBottom(index - 1),
          grid!.hasRightNeighbour(index),
        );
      });
    }

    if (xBeside) {
      // right of the last tick label: the first line in the row of the tick labels, the others below it.
      // The last panel has the axis that ends last, also when the last row of a facet grid is not full.
      const last = panels[panels.length - 1].rect;
      const x = last.x + last.width + xTitleGap;
      const y = last.y + last.height + (this.styles.scaleFactors.axisTickLength + 0.8) * em;
      xLines.forEach((line, index) => {
        this.drawText(root, line.text, x, y + index * lineH, { bold: line.bold });
      });
    } else if (xTitleText !== "") {
      this.drawAxisTitleText(
        root,
        this.config.x,
        inWord,
        drawing.x + drawing.width,
        drawing.y + drawing.height + 2.6 * em,
        "end",
      );
    }

    if (showLegend) {
      if (this.config.legend.position === "right") {
        legend.draw(
          root,
          legendModel,
          drawing.x + drawing.width + em,
          drawing.y + legendOffset(this.config.legend, drawing.height - legendSize.height),
          "right",
        );
      } else if (this.config.legend.position === "inside") {
        // in the top right corner of the plot, clear of the frame
        legend.draw(
          root,
          legendModel,
          drawing.x + drawing.width - legendSize.width - 0.5 * em,
          drawing.y + 0.3 * em + legendOffset(this.config.legend, drawing.height - legendSize.height - 0.6 * em),
          "right",
        );
      } else {
        legend.draw(
          root,
          legendModel,
          drawing.x + legendOffset(this.config.legend, drawing.width - legendSize.width),
          Math.max(drawing.y + drawing.height + xAxisH, reach.bottom),
          "bottom",
        );
      }
    }

    if (this.scaleOverflowCount > 0) {
      this.addWarningOnce("bubble-scale-overflow", { count: String(this.scaleOverflowCount) });
    }
    if (this.labelReport.unknownNames().length > 0) {
      this.addWarningOnce("xy-label-unknown", { names: this.labelReport.unknownNames().join(", ") });
    }
    if (this.labelReport.droppedNames().length > 0) {
      this.addWarningOnce("xy-label-dropped", { names: this.labelReport.droppedNames().join(", ") });
    }

    // Stable, empty hook for a future annotation layer (spec §12).
    container.group().addClass("annotations");
  }

  /** Axis title with the label bold and the "in Unit" part regular. */
  private drawAxisTitleText(
    group: G,
    axis: AxisConfig,
    inWord: string,
    x: number,
    y: number,
    anchor: "start" | "end",
  ): void {
    const label = axisLabel(axis);
    const suffix = axis.unit !== undefined && axis.unit !== "" ? `${inWord} ${axis.unit}` : "";

    // SVG collapses leading whitespace in text nodes - position the suffix
    // with an explicit gap instead.
    const gap = 0.3 * this.em;
    if (anchor === "start") {
      this.drawText(group, label, x, y, { bold: true });
      if (suffix !== "") {
        this.drawText(group, suffix, x + this.textWidth(label, true) + gap, y, {});
      }
    } else if (suffix !== "") {
      this.drawText(group, suffix, x, y, { anchor: "end" });
      this.drawText(group, label, x - this.textWidth(suffix) - gap, y, { anchor: "end", bold: true });
    } else {
      this.drawText(group, label, x, y, { anchor: "end", bold: true });
    }
  }

  /** The highest and the lowest pixel a bubble of the chart reaches, in the coordinates of the drawing. */
  private bubbleReach(panels: PanelContext[], radiusScale: RadiusScale): { top: number; bottom: number } {
    let top = Infinity;
    let bottom = -Infinity;
    this.data.facets.forEach((facet, index) => {
      const panel = panels[index];
      for (const point of facet.points) {
        for (const bubble of [point, point.compare]) {
          const r = bubble != null ? radiusScale.radius(bubble.size ?? 0) : 0;
          if (bubble == null || r <= 0) {
            continue;
          }
          const cy = panel.yScale.scale(bubble.y);
          top = Math.min(top, cy - r);
          bottom = Math.max(bottom, cy + r);
        }
      }
    });
    return { top, bottom };
  }

  private buildPanels(grid: FacetGrid, xDomain: [number, number], yDomain: [number, number]): PanelContext[] {
    const panels: PanelContext[] = [];
    for (let i = 0; i < grid.count; i++) {
      const rect = grid.panelRect(i);
      const xScale = new NumericScale(xDomain[0], xDomain[1], rect.x, rect.x + rect.width);
      const yScale = new NumericScale(yDomain[0], yDomain[1], rect.y + rect.height, rect.y);
      panels.push({ rect, xScale, yScale, frame: new XYFrame(xScale, yScale, rect, this.styles) });
    }
    return panels;
  }

  /** Fill value for a treatment; FC bubbles fill with a per-series hatch pattern. */
  private treatmentFill(treatment: MarkTreatment, seriesIndex: number, hue: string): string {
    if (treatment.hatch !== true) {
      return treatment.fill;
    }
    this.ensureHatchPattern(seriesIndex, hue);
    return `url(#xy-fc-${seriesIndex})`;
  }

  /** 45° series-hue hatch tile in the chart's own defs (shadow DOM scopes the id). */
  private ensureHatchPattern(seriesIndex: number, hue: string): void {
    if (this.hatchPatterns.has(seriesIndex) || this.svgRoot === null) {
      return;
    }
    this.hatchPatterns.add(seriesIndex);

    const defs = this.svgRoot.defs() as Container;
    defs
      .pattern(10, 10, (add) => {
        add.rect(10, 10).fill("#ffffff");
        add.line(0, 10, 10, 0).stroke({ color: hue, width: 2 });
        add.line(-2.5, 2.5, 2.5, -2.5).stroke({ color: hue, width: 2 });
        add.line(7.5, 12.5, 12.5, 7.5).stroke({ color: hue, width: 2 });
      })
      .id(`xy-fc-${seriesIndex}`);
  }

  private drawPanel(
    root: G,
    panel: PanelContext,
    facet: { key: string; points: XYPoint[] },
    radiusScale: RadiusScale,
    ticksX: number[],
    ticksY: number[],
    xDecimals: number,
    yDecimals: number,
    isOuterLeft: boolean,
    isOuterBottom: boolean,
    panelTitle: string = "",
    panelLeft: boolean = false,
    panelRight: boolean = false,
  ): void {
    const group = root.group();
    const em = this.em;

    panel.frame.drawBands(group, this.config.x.highlight, this.config.y.highlight);

    const hasRefLines = this.config.x.refLine !== undefined || this.config.y.refLine !== undefined;
    const wide = panel.rect.width > 30 * em;
    panel.frame.drawGrid(group, ticksY, !hasRefLines && wide ? ticksX : undefined);
    panel.frame.drawRefLines(group, this.config.x.refLine, this.config.y.refLine);
    panel.frame.drawFrame(group);

    // Comparison set renders in its own group BEHIND the primary set (10D) -
    // the z-order is structural, independent of rule-set sort indices.
    const compareGroup = group.group().id("compare");
    const primaryGroup = group.group().id("primary");
    // A name that finds no free place may stand on a bubble: it is still close to its own.
    const labeler = new PointLabeler(panel.rect, this.styles.scaleFactors.labelToMark * em, undefined, true);
    if (panelTitle !== "") {
      const origin = panel.frame.panelTitleOrigin();
      labeler.registerText(origin.x, origin.y - em, this.textWidth(panelTitle, true), 1.3 * em);
    }

    // Draw order: descending size, so small bubbles stay visible on top.
    const ordered = [...facet.points].sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    const marks: BubbleMark[] = [];
    const compareMarks: BubbleMark[] = [];

    for (const point of ordered) {
      const seriesIndex = this.data.series.find((s) => s.key === point.seriesKey)?.index ?? 0;
      const hue = this.seriesHue(seriesIndex);
      const treatment = this.bubbleTreatment(this.primaryColorIndex(), seriesIndex, hue);
      const cx = panel.xScale.scale(point.x);
      const cy = panel.yScale.scale(point.y);
      const r = radiusScale.radius(point.size ?? 0);

      if (this.config.sizeAreaPerUnit > 0 && this.bubbleExceedsPanel(panel.rect, cx, cy, r)) {
        this.scaleOverflowCount++;
      }

      if (point.compare != null) {
        const compareTreatment = this.bubbleTreatment(this.compareColorIndex(), seriesIndex, hue);
        const ccx = panel.xScale.scale(point.compare.x);
        const ccy = panel.yScale.scale(point.compare.y);
        const cr = radiusScale.radius(point.compare.size ?? 0);
        this.drawBubble(compareGroup, ccx, ccy, cr, compareTreatment, seriesIndex, hue);
        // an outlined bubble is see-through: a name may stand in it
        if (compareTreatment.textColor === undefined) {
          labeler.registerMark(ccx, ccy, cr);
        }
        // a comparison bubble that is fully behind its own bubble needs no second name
        if (cr > 0 && Math.hypot(ccx - cx, ccy - cy) + cr > r) {
          compareMarks.push({ point, cx: ccx, cy: ccy, r: cr, seriesIndex, hue, treatment: compareTreatment });
        }

        // Comparison bubbles carry a value label only when large enough - never a share slice.
        if (
          this.config.labels.values &&
          point.compare.size !== undefined &&
          (cr >= 1.2 * em || this.config.labels.valuesAlways === true)
        ) {
          this.drawValueLabel(compareGroup, labeler, ccx, ccy, cr, point.compare.size, compareTreatment);
        }
      }

      const key = xyPointKey(point, facet.key, this.config);
      this.drawBubble(primaryGroup, cx, cy, r, treatment, seriesIndex, hue)?.attr(dataPointAttributes(key, "element"));
      if (treatment.textColor === undefined) {
        labeler.registerMark(cx, cy, r);
      }

      if (point.share !== undefined && r > 0) {
        // no part: the bubble is the one addressable mark of this point
        this.drawShareSlice(primaryGroup, cx, cy, r, point.share, treatment, seriesIndex, hue)?.attr(
          dataPointAttributes(key),
        );
        if (this.hasShareLabel(point.name) && point.share > 0 && point.size !== undefined) {
          this.drawShareLabel(primaryGroup, labeler, cx, cy, r, point.share, point.size, treatment);
        }
      }

      if (this.config.labels.values && point.size !== undefined) {
        this.drawValueLabel(primaryGroup, labeler, cx, cy, r, point.size, treatment);
      }

      marks.push({ point, cx, cy, r, seriesIndex, hue, treatment });
    }

    this.drawNameLabels(group, labeler, marks, compareMarks, facet.key);

    panel.frame.drawTickLabels(group, {
      ticksX,
      ticksY,
      xDecimals,
      yDecimals,
      xPercent: this.xPercent,
      yPercent: this.yPercent,
      showXLabels: isOuterBottom,
      showYLabels: isOuterLeft,
      panelLeft,
      panelRight,
    });

    if (panelTitle !== "") {
      panel.frame.drawPanelTitle(group, panelTitle);
    }
  }

  private bubbleExceedsPanel(rect: Rect, cx: number, cy: number, r: number): boolean {
    return cx - r < rect.x || cx + r > rect.x + rect.width || cy - r < rect.y || cy + r > rect.y + rect.height;
  }

  private drawBubble(
    group: G,
    cx: number,
    cy: number,
    r: number,
    treatment: MarkTreatment,
    seriesIndex: number,
    hue: string,
  ): Shape | undefined {
    if (r <= 0) {
      return undefined;
    }
    return group
      .circle(r * 2)
      .center(cx, cy)
      .fill(this.treatmentFill(treatment, seriesIndex, hue))
      .attr("fill-opacity", treatment.fillOpacity ?? 1)
      .stroke({ color: treatment.stroke, width: treatment.strokeWidth });
  }

  /**
   * Pie sector from 12 o'clock, clockwise, angle = share·360° (10E). Its colour is the entry of
   * `shareColors` for the series, else a darker shade of the series colour, and for an outlined
   * series a light fill of the series colour. Its outline is the one of its bubble.
   */
  private drawShareSlice(
    group: G,
    cx: number,
    cy: number,
    r: number,
    share: number,
    treatment: MarkTreatment,
    seriesIndex: number,
    hue: string,
  ): Shape | undefined {
    if (share <= 0) {
      return undefined;
    }
    const outlined = treatment.textColor !== undefined;
    const entry: unknown = this.styles.shareColors?.[seriesIndex];
    const own = typeof entry === "string" && entry !== "" ? entry : undefined;
    const fill = own ?? (outlined ? hue : shade(hue));
    const opacity = own === undefined && outlined ? 2 * (treatment.fillOpacity ?? 1) : 1;
    const stroke = { color: treatment.stroke, width: treatment.strokeWidth };

    if (share >= 1) {
      return group
        .circle(r * 2)
        .center(cx, cy)
        .fill(fill)
        .attr("fill-opacity", opacity)
        .stroke(stroke);
    }

    const angle = share * 2 * Math.PI;
    const endX = cx + r * Math.sin(angle);
    const endY = cy - r * Math.cos(angle);
    const largeArc = angle > Math.PI ? 1 : 0;

    return group
      .path(`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`)
      .fill(fill)
      .attr({ "fill-opacity": opacity, "stroke-linejoin": "round" })
      .stroke(stroke);
  }

  /** `share.labels` asks for the value of the slice of this point. */
  private hasShareLabel(name: string): boolean {
    const labels = this.config.share?.labels ?? "none";
    return labels === "all" || (Array.isArray(labels) && labels.includes(name));
  }

  /**
   * The value of the slice (size times share), outside the bubble at the middle of the arc of the slice.
   * In the colour of the values of an outlined bubble, else in the font colour. No name is placed on it.
   */
  private drawShareLabel(
    group: G,
    labeler: PointLabeler,
    cx: number,
    cy: number,
    r: number,
    share: number,
    size: number,
    treatment: MarkTreatment,
  ): void {
    const em = this.em;
    const angle = Math.min(share, 1) * Math.PI;
    const reach = r + 0.3 * em;
    const x = cx + reach * Math.sin(angle);
    // the text hangs on its baseline: above the bubble it stands on the point, below it hangs under it
    const y = cy - reach * Math.cos(angle) + 0.35 * em * (1 - Math.cos(angle));
    const text = formatXYValue(size * share, this.valueDecimals(), this.styles.locale, this.sizePercent);
    const width = this.textWidth(text);
    this.drawText(group, text, x, y, { color: treatment.textColor });
    labeler.registerText(x, y - em, width, 1.1 * em);
  }

  /** Value inside the bubble, contrast-colored; hidden when it doesn't fit. No name is placed on it. */
  private drawValueLabel(
    group: G,
    labeler: PointLabeler,
    cx: number,
    cy: number,
    r: number,
    value: number,
    treatment: MarkTreatment,
  ): void {
    const fill = treatment.hatch === true ? "#ffffff" : treatment.fill;
    const fillOpacity = treatment.fillOpacity ?? 1;
    // a see-through fill is lighter on the page: the text colour follows what is seen
    const shown = fillOpacity < 1 && /^#[0-9a-f]{6}$/i.test(fill) ? mixHex(fill, "#ffffff", 1 - fillOpacity) : fill;
    const text = formatXYValue(value, this.valueDecimals(), this.styles.locale, this.sizePercent);
    const width = this.textWidth(text);
    const fits = width + 0.4 * this.em <= 2 * r;
    if (!fits && this.config.labels.valuesAlways !== true) {
      return;
    }
    // a value wider than its bubble is read on the page, not on the fill
    this.drawText(group, text, cx, cy + 0.35 * this.em, {
      anchor: "middle",
      color: treatment.textColor ?? (fits ? getContrastTextColor(shown) : undefined),
    });
    labeler.registerText(cx - width / 2, cy - 0.65 * this.em, width, 1.1 * this.em);
  }

  /** Name labels - bubbles are few, named entities; labels prefer the spot above (10A). */
  private drawNameLabels(
    group: G,
    labeler: PointLabeler,
    marks: BubbleMark[],
    compareMarks: BubbleMark[],
    facetKey: string,
  ): void {
    // Rank by size descending: big bubbles claim their labels first.
    const ranked = [...marks].sort((a, b) => (b.point.size ?? 0) - (a.point.size ?? 0));

    const { selected, unknownNames } = labeler.selectCandidates(
      ranked,
      this.config.labels.points,
      this.config.labels.max,
      (mark) => mark.point.name,
    );
    const pointOf = new Map<LabelCandidate, XYPoint>();
    const toCandidate = (mark: BubbleMark, primary: boolean): LabelCandidate => {
      const candidate: LabelCandidate = {
        name: mark.point.name,
        cx: mark.cx,
        cy: mark.cy,
        r: mark.r,
        width: this.textWidth(mark.point.name),
        height: 1.1 * this.em,
        // the typed side is the one of the bubble itself
        side: primary ? labelSide(this.config.labels, mark.point.name, facetKey) : undefined,
      };
      if (primary) {
        pointOf.set(candidate, mark.point);
      }
      return candidate;
    };

    // The comparison bubble of a named point carries the name too. Its name comes after all primary ones.
    const named = new Set(selected.map((mark) => mark.point));
    const candidates: LabelCandidate[] = [
      ...selected.map((mark) => toCandidate(mark, true)),
      ...compareMarks.filter((mark) => named.has(mark.point)).map((mark) => toCandidate(mark, false)),
    ];

    const placedLabels = labeler.place(candidates);
    for (const placed of placedLabels) {
      const label = this.drawText(group, placed.candidate.name, placed.x, placed.y + 0.9 * placed.candidate.height);
      const point = pointOf.get(placed.candidate);
      if (point !== undefined) {
        label.attr(dataPointAttributes(xyPointKey(point, facetKey, this.config), "label"));
      }
    }

    // only a typed list is a promise to the author: `all` and `auto` label what fits
    const placedPoints = new Set(placedLabels.map((placed) => pointOf.get(placed.candidate)));
    const dropped = Array.isArray(this.config.labels.points)
      ? selected.filter((mark) => !placedPoints.has(mark.point)).map((mark) => mark.point.name)
      : [];
    this.labelReport.addPanel(unknownNames, dropped, facetKey);
  }

  /** Decimals of the value labels: three significant digits of the largest value (32,0 and 0,0320). */
  private valueDecimals(): number {
    if (this.config.size.decimals !== undefined) {
      return this.config.size.decimals;
    }
    let largest = 0;
    for (const facet of this.data.facets) {
      for (const point of facet.points) {
        largest = Math.max(largest, Math.abs(point.size ?? 0), Math.abs(point.compare?.size ?? 0));
      }
    }
    if (!(largest > 0) || !Number.isFinite(largest)) {
      return 1;
    }
    if (this.sizePercent) {
      largest *= 100;
    }
    return NumericScale.stepDecimals(Math.pow(10, Math.floor(Math.log10(largest)) - 2));
  }
}
