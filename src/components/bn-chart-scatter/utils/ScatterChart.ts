import { G, Svg } from "@svgdotjs/svg.js";
import CalculateSize from "calculate-size";
import { AlaSQLDatabase } from "../../../context/scopedDb";
import { errorText } from "../../../utils/queryError";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { FacetGrid, Rect } from "../../../utils/xy/FacetGrid";
import { formatXYValue, xyTickDecimals } from "../../../utils/xy/formatXYValue";
import { IsoCurves } from "../../../utils/xy/IsoCurves";
import { NumericScale } from "../../../utils/xy/NumericScale";
import { LabelCandidate, PointLabeler } from "../../../utils/xy/PointLabeler";
import { markTreatment, MarkTreatment, resolveSeriesColor } from "../../../utils/xy/SeriesPalette";
import { axisInValueUnits, isRelativeMeasure, resolveMeasure } from "../../../utils/xy/VarianceMeasure";
import { XYFrame } from "../../../utils/xy/XYFrame";
import { LegendEntry, LegendModel, XYLegend } from "../../../utils/xy/XYLegend";
import { AxisConfig, FacetConfig, IsoConfig, LabelConfig, LegendConfig } from "../../../utils/xy/model/AxisConfig";
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

/** Prepared configuration handed to the scatter orchestrator by the inner element. */
export interface ScatterChartConfig {
  chartTitle: string;
  x: AxisConfig;
  y: AxisConfig;
  iso: IsoConfig | null;
  labels: LabelConfig;
  legend: LegendConfig;
  facet: FacetConfig | null;
  pointLevel: PointLevel;
  seriesLevel: GroupLevel | null;
  /** Plot aspect ratio as width/height (16:9 → 16/9). */
  aspect: number;
  limit: number;
}

interface PanelContext {
  rect: Rect;
  xScale: NumericScale;
  yScale: NumericScale;
  frame: XYFrame;
}

/**
 * SVG orchestrator for `bn-chart-scatter` (IBCS template C09).
 *
 * Pipeline per render: adapt rows → resolve facets/series/points → resolve
 * shared scales → per panel: bands → iso → refLines → frame → dots →
 * labels → tick labels → panel title; then the legend and chart title.
 * The SVG is built on a detached `Svg` root and emitted via `toString()`.
 */
export class ScatterChart {
  private data: ResolvedXYData;
  private warnings: XYWarningRecord[] = [];
  /** Text of the query that failed. The component reports it as ERR_sql. */
  private queryError: string | undefined;
  private canvasHeight: number = 0;

  constructor(
    private readonly ruleSet: IBCSRuleSet,
    db: AlaSQLDatabase,
    fromExpr: string,
    private readonly config: ScatterChartConfig,
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
      },
      domains: {
        x: { min: this.config.x.min, max: this.config.x.max },
        y: { min: this.config.y.min, max: this.config.y.max },
      },
      limit: config.limit,
      limitBy: "order",
    });
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

  private fontFamily(): string {
    return this.styles.fontStyles.font.replace(/^[\d.]+px\s*/, "");
  }

  private textWidth(text: string, bold: boolean = false): number {
    const width = CalculateSize(text, {
      font: this.styles.fontStyles.font,
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
    options: { anchor?: string; bold?: boolean; color?: string; size?: number } = {},
  ): void {
    group
      .text(text)
      .font({
        size: options.size ?? this.styles.fontStyles.size,
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

  /** Axis title in the IBCS "Label in Unit" form. */
  private axisTitle(axis: AxisConfig, inWord: string): string {
    const label = axis.label ?? "";
    if (label === "") {
      return "";
    }
    if (axis.unit === undefined || axis.unit === "") {
      return label;
    }
    return `${label} ${inWord} ${axis.unit}`;
  }

  private i18nMap: Map<string, string> = new Map();

  public setI18n(i18n: Map<string, string>): void {
    this.i18nMap = i18n;
  }

  /** Ordered legend entries: one per series, colored by the primary treatment. */
  private legendModel(): LegendModel {
    const entries: LegendEntry[] = this.data.series.map((series) => ({
      label: series.key === "" ? (this.ruleSet.getScenario("").name ?? "Series") : series.key,
      treatment: this.seriesTreatment(series.index),
    }));

    return {
      sizeCaption: [],
      title: this.i18nMap.get("legend.title") || null,
      compareEntries: [],
      entries,
    };
  }

  /** ColorIndex of the primary scenario family (variance axes → 10, spec §4.4). */
  private primaryColorIndex(): number {
    const ref = resolveMeasure(this.config.x.measure);
    if (ref === null || ref.kind === "variance") {
      return 10;
    }
    return this.ruleSet.getScenarioColorIndex(ref.slot);
  }

  private seriesTreatment(seriesIndex: number): MarkTreatment {
    const { color, overflowed } = resolveSeriesColor(seriesIndex, this.styles.seriesColors);
    if (overflowed) {
      this.addWarningOnce("xy-series-overflow", {});
    }
    return markTreatment(this.primaryColorIndex(), color, "dot");
  }

  private addWarningOnce(code: string, data: Record<string, string>): void {
    if (!this.warnings.some((w) => w.code === code)) {
      this.warnings.push({ code, data });
    }
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

  private draw(container: Svg): void {
    this.warnings = this.data.warnings.slice();
    const em = this.em;
    const padding = this.styles.padding;
    const inWord = this.i18nMap.get("axis.in") || "in";

    const root = container.group();
    const legend = new XYLegend(this.styles);
    const legendModel = this.legendModel();
    const showLegend = this.config.legend.show && legendModel.entries.length > 0;
    const legendSize = showLegend ? legend.measure(legendModel, this.config.legend.position) : { width: 0, height: 0 };

    // Reserved column right of the frame: legend and/or iso exit labels.
    const isoActive = this.config.iso !== null;
    const isoLabelReserve = isoActive
      ? Math.max(
          3 * em,
          ...this.isoValueLabels().map((label) => this.textWidth(label) + em),
          this.textWidth(this.config.iso!.label ?? "", true) + em,
          this.textWidth(
            this.config.iso!.unit !== undefined && this.config.iso!.unit !== ""
              ? `${inWord} ${this.config.iso!.unit}`
              : "",
          ) + em,
        )
      : 0;
    const rightReserve =
      this.config.legend.position === "right"
        ? Math.max(showLegend ? legendSize.width + em : 0, isoLabelReserve)
        : isoLabelReserve;

    const titleH = this.config.chartTitle !== "" ? 1.6 * em : 0;
    const yTitleText = this.axisTitle(this.config.y, inWord);
    const xTitleText = this.axisTitle(this.config.x, inWord);
    const yTitleH = yTitleText !== "" ? 1.4 * em : 0.4 * em;
    const xAxisH = 1.4 * em + (xTitleText !== "" ? 1.3 * em : 0);

    // First pass with an estimated left-axis reservation, refined below.
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

    for (let pass = 0; pass < 2; pass++) {
      const drawingW = Math.max(10, this.availableWidth - padding.left - padding.right - axisLeftW - rightReserve);
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
      ticksY = yScale.ticks(targetY);

      const yDecimals = xyTickDecimals(ticksY, this.yPercent);
      const maxTickW = Math.max(
        ...ticksY.map((tick) => this.textWidth(formatXYValue(tick, yDecimals, this.styles.locale, this.yPercent))),
        em,
      );
      axisLeftW = maxTickW + this.styles.scaleFactors.axisTickLength * em + 0.4 * em;
    }

    this.canvasHeight =
      drawing.y +
      drawing.height +
      xAxisH +
      (this.config.legend.position === "bottom" && showLegend ? legendSize.height + em : 0) +
      padding.bottom;

    // Chart title.
    if (this.config.chartTitle !== "") {
      this.drawText(root, this.config.chartTitle, padding.left, padding.top + em, { bold: true });
    }

    // Y axis title, top-left above the plot (template style).
    if (yTitleText !== "") {
      this.drawAxisTitleText(root, this.config.y, inWord, padding.left, drawing.y - 0.6 * em, "start");
    }

    const panels = this.buildPanels(grid!, xDomain, yDomain);
    const ticksX = panels[0].xScale.ticks(Math.max(3, Math.min(8, Math.round(panels[0].rect.width / (7 * em)))));
    const xDecimals = xyTickDecimals(ticksX, this.xPercent);
    const yDecimals = xyTickDecimals(ticksY, this.yPercent);

    // Iso guard: requires a strictly positive domain on both axes.
    let isoDrawable = false;
    if (isoActive) {
      if (xDomain[0] > 0 && yDomain[0] > 0) {
        isoDrawable = true;
      } else {
        this.addWarningOnce("xy-iso-domain", {});
      }
    }

    if (this.data.facets.length === 0) {
      this.drawPanel(
        root,
        panels[0],
        { key: "", points: [] },
        ticksX,
        ticksY,
        xDecimals,
        yDecimals,
        true,
        true,
        isoDrawable,
      );
    } else {
      this.data.facets.forEach((facet, index) => {
        this.drawPanel(
          root,
          panels[index],
          facet,
          ticksX,
          ticksY,
          xDecimals,
          yDecimals,
          grid!.isOuterLeft(index),
          grid!.isOuterBottom(index),
          isoDrawable,
          this.data.facets.length > 1 ? facet.key : "",
        );
      });
    }

    // X axis title, right-aligned below the bottom-right panel.
    if (xTitleText !== "") {
      this.drawAxisTitleText(
        root,
        this.config.x,
        inWord,
        drawing.x + drawing.width,
        drawing.y + drawing.height + 2.6 * em,
        "end",
      );
    }

    // Legend (chart-level, once).
    if (showLegend) {
      if (this.config.legend.position === "right") {
        legend.draw(root, legendModel, drawing.x + drawing.width + em, drawing.y, "right");
      } else {
        legend.draw(root, legendModel, drawing.x, drawing.y + drawing.height + xAxisH, "bottom");
      }
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
    const label = axis.label ?? "";
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

  private drawPanel(
    root: G,
    panel: PanelContext,
    facet: { key: string; points: XYPoint[] },
    ticksX: number[],
    ticksY: number[],
    xDecimals: number,
    yDecimals: number,
    isOuterLeft: boolean,
    isOuterBottom: boolean,
    isoDrawable: boolean,
    panelTitle: string = "",
  ): void {
    const group = root.group();
    const em = this.em;

    panel.frame.drawBands(group, this.config.x.highlight, this.config.y.highlight);

    // Gridlines: horizontal always; vertical only without refLines on wide panels.
    const hasRefLines = this.config.x.refLine !== undefined || this.config.y.refLine !== undefined;
    const wide = panel.rect.width > 30 * em;
    panel.frame.drawGrid(group, ticksY, !hasRefLines && wide ? ticksX : undefined);

    if (isoDrawable && this.config.iso !== null) {
      this.drawIso(group, panel);
    }

    panel.frame.drawRefLines(group, this.config.x.refLine, this.config.y.refLine);
    panel.frame.drawFrame(group);

    // Marks: filled circles in data order, white separation stroke.
    const radius = this.styles.scaleFactors.pointRadius * em;
    const labeler = new PointLabeler(panel.rect, this.styles.scaleFactors.labelToMark * em);
    const marks: { point: XYPoint; cx: number; cy: number; treatment: MarkTreatment }[] = [];

    for (const point of facet.points) {
      const seriesIndex = this.data.series.find((s) => s.key === point.seriesKey)?.index ?? 0;
      const treatment = this.seriesTreatment(seriesIndex);
      const cx = panel.xScale.scale(point.x);
      const cy = panel.yScale.scale(point.y);
      marks.push({ point, cx, cy, treatment });

      const circle = group
        .circle(radius * 2)
        .center(cx, cy)
        .fill(treatment.fill)
        .stroke({ color: treatment.stroke, width: treatment.strokeWidth });
      if (treatment.dasharray !== undefined) {
        circle.attr("stroke-dasharray", treatment.dasharray);
      }
      labeler.registerMark(cx, cy, radius);
    }

    this.drawPointLabels(group, labeler, marks, radius);

    panel.frame.drawTickLabels(group, {
      ticksX,
      ticksY,
      xDecimals,
      yDecimals,
      xPercent: this.xPercent,
      yPercent: this.yPercent,
      showXLabels: isOuterBottom,
      showYLabels: isOuterLeft,
    });

    if (panelTitle !== "") {
      panel.frame.drawPanelTitle(group, panelTitle);
    }
  }

  private drawPointLabels(
    group: G,
    labeler: PointLabeler,
    marks: { point: XYPoint; cx: number; cy: number; treatment: MarkTreatment }[],
    radius: number,
  ): void {
    // Rank by extremity: distance from the pixel-space centroid.
    const centroidX = marks.reduce((sum, m) => sum + m.cx, 0) / Math.max(1, marks.length);
    const centroidY = marks.reduce((sum, m) => sum + m.cy, 0) / Math.max(1, marks.length);
    const ranked = [...marks].sort(
      (a, b) => Math.hypot(b.cx - centroidX, b.cy - centroidY) - Math.hypot(a.cx - centroidX, a.cy - centroidY),
    );

    const { selected, unknownNames } = labeler.selectCandidates(
      ranked,
      this.config.labels.points,
      this.config.labels.max,
      (mark) => mark.point.name,
    );
    if (unknownNames.length > 0) {
      this.addWarningOnce("xy-label-unknown", { names: unknownNames.join(", ") });
    }

    const candidates: LabelCandidate[] = selected.map((mark) => ({
      name: mark.point.name,
      cx: mark.cx,
      cy: mark.cy,
      r: radius,
      width: this.textWidth(mark.point.name),
      height: 1.1 * this.em,
    }));

    for (const placed of labeler.place(candidates)) {
      this.drawText(group, placed.candidate.name, placed.x, placed.y + 0.9 * placed.candidate.height, {});
    }
  }

  private drawIso(group: G, panel: PanelContext): void {
    const iso = this.config.iso!;
    const curves = new IsoCurves(panel.xScale, panel.yScale);
    const inWord = this.i18nMap.get("axis.in") || "in";

    const ks = this.isoValues();
    const labels = this.isoValueLabels();

    if (iso.highlight !== undefined) {
      const region = curves.regionPath(iso.highlight.from);
      if (region !== null) {
        group.path(region).fill(this.styles.axisStyles.pl.fill).stroke("none");
      }
    }

    const stroke = { color: this.styles.axisStyles.fc.stroke, width: this.styles.scaleFactors.gridLineWidth };
    let topExit: { x: number; y: number } | null = null;

    for (const [index, k] of ks.entries()) {
      const path = curves.path(k);
      if (path === null) {
        continue;
      }
      group.path(path).fill("none").stroke(stroke);

      const exit = curves.exitPoint(k);
      if (exit === null) {
        continue;
      }
      if (exit.edge === "right") {
        this.drawText(group, labels[index], exit.x + 0.4 * this.em, exit.y + 0.35 * this.em, {});
      } else {
        // Bottom exit: keep the label inside the frame, above-right of the curve end.
        this.drawText(group, labels[index], exit.x + 0.4 * this.em, exit.y - 0.5 * this.em, {});
      }
      if (topExit === null || exit.y < topExit.y) {
        topExit = exit;
      }
    }

    // Edge caption ("Gross profit in mUSD"), once, above the topmost k label.
    if (topExit !== null && iso.label !== undefined && iso.label !== "") {
      const suffix = iso.unit !== undefined && iso.unit !== "" ? `${inWord} ${iso.unit}` : "";
      this.drawText(group, iso.label, topExit.x + 0.4 * this.em, topExit.y - 1.6 * this.em, { bold: true });
      if (suffix !== "") {
        this.drawText(group, suffix, topExit.x + 0.4 * this.em, topExit.y - 0.5 * this.em, {});
      }
    }
  }

  /** The products x * y the iso lines are drawn for. */
  private isoValues(): number[] {
    const iso = this.config.iso!;
    if (iso.values !== "auto") {
      return iso.values;
    }
    return IsoCurves.autoK(this.data.facets.flatMap((facet) => facet.points.map((p) => p.x * p.y)));
  }

  /** Labels of the iso lines, all with the decimals the finest value needs (0,5 and 1,0, not 1 and 1). */
  private isoValueLabels(): string[] {
    const ks = this.isoValues();
    const decimals = Math.max(0, ...ks.map((k) => NumericScale.stepDecimals(Math.abs(k))));
    return ks.map((k) => formatXYValue(k, decimals, this.styles.locale));
  }
}
