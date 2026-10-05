import { Container, G, Svg } from "@svgdotjs/svg.js";
import CalculateSize from "calculate-size";
import { AlaSQLDatabase } from "../../../context/scopedDb";
import { IBCSRuleSet } from "../../../utils/ibcsRuleSet";
import { getContrastTextColor } from "../../../utils/stackColors";
import { FacetGrid, Rect } from "../../../utils/xy/FacetGrid";
import { formatXYValue } from "../../../utils/xy/formatXYValue";
import { NumericScale } from "../../../utils/xy/NumericScale";
import { LabelCandidate, PointLabeler } from "../../../utils/xy/PointLabeler";
import { markTreatment, MarkTreatment, resolveSeriesColor, shade } from "../../../utils/xy/SeriesPalette";
import { RadiusScale } from "../../../utils/xy/RadiusScale";
import { resolveMeasure } from "../../../utils/xy/VarianceMeasure";
import { XYFrame } from "../../../utils/xy/XYFrame";
import { LegendEntry, LegendModel, XYLegend } from "../../../utils/xy/XYLegend";
import {
  AxisConfig,
  FacetConfig,
  LabelConfig,
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
  private canvasHeight: number = 0;
  private i18nMap: Map<string, string> = new Map();
  private hatchPatterns: Set<number> = new Set();
  private scaleOverflowCount: number = 0;
  private svgRoot: Svg | null = null;

  constructor(
    private readonly ruleSet: IBCSRuleSet,
    db: AlaSQLDatabase,
    fromExpr: string,
    private readonly config: BubbleChartConfig,
    public readonly styles: XYChartStyle,
    private readonly availableWidth: number,
  ) {
    const adapter = new XYChartDataRowAdapter();
    const rawRows = fromExpr !== "" ? db.exec<Record<string, unknown>[]>(`SELECT * FROM ${fromExpr}`) : [];
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
        x: { min: config.x.min, max: config.x.max },
        y: { min: config.y.min, max: config.y.max },
      },
      limit: config.limit,
      limitBy: "size",
    });
    this.warnings.push(...this.data.warnings);
  }

  private get em(): number {
    return this.styles.fontStyles.size;
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
    options: { anchor?: string; bold?: boolean; color?: string } = {},
  ): void {
    group
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

    const firstHue = this.seriesHue(0);
    const compareEntries: LegendEntry[] = [];
    if (this.config.compareFamily !== null) {
      const primaryRef = resolveMeasure(this.config.size.measure);
      const primaryFamily =
        primaryRef !== null && primaryRef.kind === "scenario" ? primaryRef.slot.replace(/\d+$/, "") : "ac";
      compareEntries.push({
        label: this.familyDisplayName(this.config.compareFamily),
        treatment: markTreatment(this.compareColorIndex(), firstHue, "bubble"),
      });
      compareEntries.push({
        label: this.familyDisplayName(primaryFamily),
        treatment: markTreatment(this.primaryColorIndex(), firstHue, "bubble"),
      });
    }

    const entries: LegendEntry[] = this.data.series.map((series) => ({
      label: series.key === "" ? (this.ruleSet.getScenario("").name ?? "Series") : series.key,
      treatment: markTreatment(this.primaryColorIndex(), this.seriesHue(series.index), "bubble"),
    }));

    return {
      sizeCaption,
      title: this.i18nMap.get("legend.title") || null,
      compareEntries,
      entries,
    };
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
    const label = axis.label ?? "";
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
    this.svgRoot = container;
    const em = this.em;
    const padding = this.styles.padding;
    const inWord = this.i18nMap.get("axis.in") || "in";

    const root = container.group();
    const legend = new XYLegend(this.styles);
    const legendModel = this.legendModel();
    const showLegend =
      this.config.legend.show && (legendModel.entries.length > 0 || legendModel.sizeCaption.length > 0);
    const legendSize = showLegend ? legend.measure(legendModel, this.config.legend.position) : { width: 0, height: 0 };

    const rightReserve = this.config.legend.position === "right" && showLegend ? legendSize.width + em : 0;

    const titleH = this.config.chartTitle !== "" ? 1.6 * em : 0;
    const yTitleText = this.axisTitle(this.config.y, inWord);
    const xTitleText = this.axisTitle(this.config.x, inWord);
    const yTitleH = yTitleText !== "" ? 1.4 * em : 0.4 * em;
    const xAxisH = 1.4 * em + (xTitleText !== "" ? 1.3 * em : 0);

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

      const yDecimals = NumericScale.tickDecimals(ticksY);
      const maxTickW = Math.max(
        ...ticksY.map((tick) => this.textWidth(formatXYValue(tick, yDecimals, this.styles.locale))),
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

    if (this.config.chartTitle !== "") {
      this.drawText(root, this.config.chartTitle, padding.left, padding.top + em, { bold: true });
    }

    if (yTitleText !== "") {
      this.drawAxisTitleText(root, this.config.y, inWord, padding.left, drawing.y - 0.6 * em, "start");
    }

    const panels = this.buildPanels(grid!, xDomain, yDomain);
    const ticksX = panels[0].xScale.ticks(Math.max(3, Math.min(8, Math.round(panels[0].rect.width / (7 * em)))));
    const xDecimals = NumericScale.tickDecimals(ticksX);
    const yDecimals = NumericScale.tickDecimals(ticksY);

    const radiusScale =
      this.config.sizeAreaPerUnit > 0
        ? RadiusScale.grouped(this.config.sizeAreaPerUnit)
        : RadiusScale.local(
            this.data.extents?.sizeMax ?? 0,
            this.styles.scaleFactors.bubbleMaxRadius * em,
            this.styles.scaleFactors.bubbleMinRadius * em,
          );

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
        );
      });
    }

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

    if (showLegend) {
      if (this.config.legend.position === "right") {
        legend.draw(root, legendModel, drawing.x + drawing.width + em, drawing.y, "right");
      } else {
        legend.draw(root, legendModel, drawing.x, drawing.y + drawing.height + xAxisH, "bottom");
      }
    }

    if (this.scaleOverflowCount > 0) {
      this.addWarningOnce("bubble-scale-overflow", { count: String(this.scaleOverflowCount) });
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
    const labeler = new PointLabeler(panel.rect, this.styles.scaleFactors.labelToMark * em);

    // Draw order: descending size, so small bubbles stay visible on top.
    const ordered = [...facet.points].sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    const marks: BubbleMark[] = [];

    for (const point of ordered) {
      const seriesIndex = this.data.series.find((s) => s.key === point.seriesKey)?.index ?? 0;
      const hue = this.seriesHue(seriesIndex);
      const treatment = markTreatment(this.primaryColorIndex(), hue, "bubble");
      const cx = panel.xScale.scale(point.x);
      const cy = panel.yScale.scale(point.y);
      const r = radiusScale.radius(point.size ?? 0);

      if (this.config.sizeAreaPerUnit > 0 && this.bubbleExceedsPanel(panel.rect, cx, cy, r)) {
        this.scaleOverflowCount++;
      }

      if (point.compare != null) {
        const compareTreatment = markTreatment(this.compareColorIndex(), hue, "bubble");
        const ccx = panel.xScale.scale(point.compare.x);
        const ccy = panel.yScale.scale(point.compare.y);
        const cr = radiusScale.radius(point.compare.size ?? 0);
        this.drawBubble(compareGroup, ccx, ccy, cr, compareTreatment, seriesIndex, hue);
        labeler.registerMark(ccx, ccy, cr);

        // Comparison bubbles carry a value label only when large enough - never a share slice.
        if (this.config.labels.values && point.compare.size !== undefined && cr >= 1.2 * em) {
          this.drawValueLabel(compareGroup, ccx, ccy, cr, point.compare.size, compareTreatment.fill);
        }
      }

      this.drawBubble(primaryGroup, cx, cy, r, treatment, seriesIndex, hue);
      labeler.registerMark(cx, cy, r);

      if (point.share !== undefined && r > 0) {
        this.drawShareSlice(primaryGroup, cx, cy, r, point.share, shade(hue));
      }

      if (this.config.labels.values && point.size !== undefined) {
        this.drawValueLabel(primaryGroup, cx, cy, r, point.size, treatment.hatch === true ? "#ffffff" : treatment.fill);
      }

      marks.push({ point, cx, cy, r, seriesIndex, hue, treatment });
    }

    this.drawNameLabels(group, labeler, marks);

    panel.frame.drawTickLabels(group, {
      ticksX,
      ticksY,
      xDecimals,
      yDecimals,
      showXLabels: isOuterBottom,
      showYLabels: isOuterLeft,
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
  ): void {
    if (r <= 0) {
      return;
    }
    group
      .circle(r * 2)
      .center(cx, cy)
      .fill(this.treatmentFill(treatment, seriesIndex, hue))
      .stroke({ color: treatment.stroke, width: treatment.strokeWidth });
  }

  /** Pie sector from 12 o'clock, clockwise, angle = share·360° (10E). */
  private drawShareSlice(group: G, cx: number, cy: number, r: number, share: number, fill: string): void {
    if (share <= 0) {
      return;
    }
    if (share >= 1) {
      group
        .circle(r * 2)
        .center(cx, cy)
        .fill(fill);
      return;
    }

    const angle = share * 2 * Math.PI;
    const endX = cx + r * Math.sin(angle);
    const endY = cy - r * Math.cos(angle);
    const largeArc = angle > Math.PI ? 1 : 0;

    group
      .path(`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`)
      .fill(fill)
      .stroke("none");
  }

  /** Value inside the bubble, contrast-colored; hidden when it doesn't fit. */
  private drawValueLabel(group: G, cx: number, cy: number, r: number, value: number, fill: string): void {
    const text = formatXYValue(value, this.valueDecimals(), this.styles.locale);
    const width = this.textWidth(text);
    if (width + 0.4 * this.em > 2 * r) {
      return;
    }
    this.drawText(group, text, cx, cy + 0.35 * this.em, {
      anchor: "middle",
      color: getContrastTextColor(fill.startsWith("#") ? fill : "#ffffff"),
    });
  }

  /** Name labels - bubbles are few, named entities; labels prefer the spot above (10A). */
  private drawNameLabels(group: G, labeler: PointLabeler, marks: BubbleMark[]): void {
    // Rank by size descending: big bubbles claim their labels first.
    const ranked = [...marks].sort((a, b) => (b.point.size ?? 0) - (a.point.size ?? 0));

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
      r: mark.r,
      width: this.textWidth(mark.point.name),
      height: 1.1 * this.em,
    }));

    for (const placed of labeler.place(candidates)) {
      this.drawText(group, placed.candidate.name, placed.x, placed.y + 0.9 * placed.candidate.height, {});
    }
  }

  /** Decimals of the value labels: three significant digits of the largest value (32,0 and 0,0320). */
  private valueDecimals(): number {
    let largest = 0;
    for (const facet of this.data.facets) {
      for (const point of facet.points) {
        largest = Math.max(largest, Math.abs(point.size ?? 0), Math.abs(point.compare?.size ?? 0));
      }
    }
    if (!(largest > 0) || !Number.isFinite(largest)) {
      return 1;
    }
    return NumericScale.stepDecimals(Math.pow(10, Math.floor(Math.log10(largest)) - 2));
  }
}
