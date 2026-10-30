import { G, Svg, Text } from "@svgdotjs/svg.js";
import { dataPointAttributes, levelKey } from "../../../utils/layoutState/dataPoint";
import { DataPointKey } from "../../../utils/layoutState/types";
import CalculateSize from "calculate-size";
import { AlaSQLDatabase } from "../../../context/scopedDb";
import { errorText } from "../../../utils/queryError";
import { AggregationLevel } from "../../../utils/constants";
import { Formatter } from "../../../utils/formatter";
import { IBCSRuleSet, styleSlot } from "../../../utils/ibcsRuleSet";
import { Order, OrderColumn } from "../../../utils/model/Order";
import { NumericScale } from "../../../utils/xy/NumericScale";
import { XYWarningRecord } from "../../../utils/xy/model/XYChartDataRow";
import { BulletChartStyle } from "./model/BulletChartStyle";
import { strokeWidthPx } from "../../../utils/scaling";
import { BulletLabelConfig, BulletMeasureConfig } from "./model/BulletConfig";

/** Prepared configuration handed to the bullet orchestrator by the inner element. */
export interface BulletChartConfig {
  chartTitle: string;
  /** Resolved actual measure - always a plain scenario slot. */
  actual: BulletMeasureConfig;
  /** Resolved target measure, `null` when no target scenario is available. */
  target: BulletMeasureConfig | null;
  /** Ascending fractions of the target, at most two (classic mode bands). */
  ranges: number[];
  normalize: "target" | "none";
  showVariances: boolean;
  level: AggregationLevel;
  order: Order;
  /** 0 = all rows; positive values truncate (no REST aggregate - summing heterogeneous KPIs is meaningless). */
  limit: number;
  labels: BulletLabelConfig;
}

/** One aggregated KPI row. */
interface BulletRowModel {
  category: string;
  actual: number | null;
  target: number | null;
  operation: "+" | "-";
  sentiment: "pos" | "neg" | "neu";
  /** `actual / target`; `null` when the row cannot be normalized. */
  fraction: number | null;
}

/**
 * SVG orchestrator for `bn-chart-bullet` (IBCS bullet graph).
 *
 * One horizontal row per KPI: a solid AC bar, a target marker, and - in the
 * default normalized mode - an integrated variance bar between actual and
 * target. Normalization maps every row to fractions of its target, so one
 * continuous target line spans all rows (IBCS: normalized target values).
 * Classic mode (`normalize: "none"`) draws per-row scales with tick strips
 * and optional qualitative range bands (max two, per the IBCS critique of
 * the arbitrary third band). The SVG is built on a detached `Svg` root and
 * emitted via `toString()`.
 */
export class BulletChart {
  private rows: BulletRowModel[] = [];
  private warnings: XYWarningRecord[] = [];
  /** Text of the query that failed. The component reports it as ERR_sql. */
  private queryError: string | undefined;
  /** True when the default normalized mode is drawable (some row has a usable target). */
  private normalized: boolean;

  constructor(
    private readonly ruleSet: IBCSRuleSet,
    db: AlaSQLDatabase,
    fromExpr: string,
    private readonly config: BulletChartConfig,
    public readonly styles: BulletChartStyle,
    private readonly availableWidth: number,
  ) {
    this.populateModel(db, fromExpr);
    this.normalized = this.config.normalize === "target" && this.rows.some((row) => row.fraction !== null);

    if (this.config.target !== null && this.rows.length > 0 && !this.rows.some((row) => row.target !== null)) {
      this.warnings.push({ code: "bullet-target-none", data: {} });
    }
  }

  private populateModel(db: AlaSQLDatabase, fromExpr: string): void {
    if (fromExpr === "") {
      return;
    }

    const level = this.config.level;
    const order = this.config.order;
    const actualSlot = this.config.actual.measure;
    const targetSlot = this.config.target?.measure ?? null;

    // A group of one kind keeps its plain sum (a cost KPI shows a positive value).
    // A group that mixes '+' and '-' rows is a net value: the '-' rows are subtracted.
    // The alias holds the value that is shown, so ORDER BY sorts by it.
    const sign = "transformOperator(operation)";
    const measureSelect = [actualSlot, ...(targetSlot !== null ? [targetSlot] : [])]
      .map(
        (slot) =>
          `CASE WHEN MIN(${sign}) = MAX(${sign}) THEN SUM(${slot}) ELSE SUM(${slot} * ${sign}) END as ${slot}, ` +
          `SUM(ABS(${slot})) as ${slot}_gross, COUNT(ISNULL(${slot})) as ${slot}_cnt`,
      )
      .join(", ");

    let result: Record<string, unknown>[];
    try {
      // transformOperator maps the operation strings to ±1 - alasql cannot MIN/MAX over VARCHAR columns.
      result = db.exec<Record<string, unknown>[]>(
        `SELECT ${this.createSelectString(level, order)}, ${measureSelect},
                MIN(transformOperator(operation)) as opMin, MAX(transformOperator(operation)) as opMax
         FROM ${fromExpr}
         GROUP BY ${this.createGroupByStr(level, order)}
         ORDER BY ${this.createOrderStr(level, order)}`,
      );
    } catch (e) {
      this.queryError = errorText(e);
      return;
    }

    let records = result ?? [];
    if (this.config.limit > 0) {
      records = records.slice(0, this.config.limit);
    }

    let mixedOperations = 0;
    let targetMissing = 0;
    let targetInvalid = 0;
    let actualNegative = 0;

    for (const record of records) {
      const opMin = typeof record.opMin === "number" ? record.opMin : 1;
      const opMax = typeof record.opMax === "number" ? record.opMax : 1;
      let operation: "+" | "-" = opMin === -1 && opMax === -1 ? "-" : "+";
      if (opMin !== opMax) {
        operation = "+";
        mixedOperations++;
      }

      const actual = this.readValue(record, actualSlot);
      const target = targetSlot !== null ? this.readValue(record, targetSlot) : null;

      if (actual !== null && actual < 0) {
        actualNegative++;
      }

      let fraction: number | null = null;
      if (this.config.normalize === "target") {
        if (target === null) {
          if (targetSlot !== null) {
            targetMissing++;
          }
        } else if (target <= 0) {
          targetInvalid++;
        } else if (actual !== null && actual >= 0) {
          fraction = actual / target;
        }
      }

      this.rows.push({
        category: String(record.category ?? ""),
        actual,
        target,
        operation,
        sentiment: this.sentiment(actual, target, operation),
        fraction,
      });
    }

    if (mixedOperations > 0) {
      this.warnings.push({ code: "bullet-mixed-operation", data: { count: String(mixedOperations) } });
    }
    if (targetMissing > 0) {
      this.warnings.push({ code: "bullet-target-missing", data: { count: String(targetMissing) } });
    }
    if (targetInvalid > 0) {
      this.warnings.push({ code: "bullet-target-invalid", data: { count: String(targetInvalid) } });
    }
    if (actualNegative > 0) {
      this.warnings.push({ code: "bullet-actual-negative", data: { count: String(actualNegative) } });
    }
  }

  private readValue(record: Record<string, unknown>, slot: string): number | null {
    if (record[`${slot}_cnt`] === 0) {
      return null;
    }
    const value = record[slot];
    // a net value that is 0 only up to the float rounding of its sum (0.3 - 0.1 - 0.2) is 0, not a tiny negative
    const gross = record[`${slot}_gross`];
    if (typeof value === "number" && typeof gross === "number" && Math.abs(value) <= gross * 1e-9) {
      return 0;
    }
    return typeof value === "number" && isFinite(value) ? value : null;
  }

  /**
   * Favorable/unfavorable direction of the actual-vs-target variance.
   * `operation: "-"` marks cost-type KPIs, inverting the reading - the sign
   * flip philosophy of the structure chart's `DataPoint.getVarianceStyle()`,
   * keyed on the row operation because bullet variances are implicit rather
   * than user-declared `_pos`/`_neg` tokens.
   */
  private sentiment(actual: number | null, target: number | null, operation: "+" | "-"): "pos" | "neg" | "neu" {
    if (actual === null || target === null || actual === target) {
      return "neu";
    }
    return actual > target !== (operation === "-") ? "pos" : "neg";
  }

  private createSelectString(level: AggregationLevel, sortOrder: Order): string {
    if (level === AggregationLevel.CATEGORY && sortOrder.hierarchy.includes(OrderColumn.CATEGORYINDEX)) {
      return `${OrderColumn.CATEGORYINDEX}, ${AggregationLevel.CATEGORY} as category`;
    } else if (level === AggregationLevel.ROWGROUP && sortOrder.hierarchy.includes(OrderColumn.ROWGROUPINDEX)) {
      return `${OrderColumn.ROWGROUPINDEX}, ${AggregationLevel.ROWGROUP} as category`;
    } else if (level === AggregationLevel.SUBCATEGORY && sortOrder.hierarchy.includes(OrderColumn.SUBCATEGORYINDEX)) {
      return `${OrderColumn.SUBCATEGORYINDEX}, ${AggregationLevel.SUBCATEGORY} as category`;
    } else {
      return `${level.toString()} as category`;
    }
  }

  private createGroupByStr(level: AggregationLevel, sortOrder: Order): string {
    if (level === AggregationLevel.CATEGORY && sortOrder.hierarchy.includes(OrderColumn.CATEGORYINDEX)) {
      return `${OrderColumn.CATEGORYINDEX}, ${AggregationLevel.CATEGORY}`;
    } else if (level === AggregationLevel.ROWGROUP && sortOrder.hierarchy.includes(OrderColumn.ROWGROUPINDEX)) {
      return `${OrderColumn.ROWGROUPINDEX}, ${AggregationLevel.ROWGROUP}`;
    } else if (level === AggregationLevel.SUBCATEGORY && sortOrder.hierarchy.includes(OrderColumn.SUBCATEGORYINDEX)) {
      return `${OrderColumn.SUBCATEGORYINDEX}, ${AggregationLevel.SUBCATEGORY}`;
    } else {
      return `${level.toString()}`;
    }
  }

  private createOrderStr(level: AggregationLevel, sortOrder: Order): string {
    let orderStr = `${level.toLowerCase()}`;
    if (sortOrder.hierarchy.length >= 1) {
      orderStr = sortOrder.hierarchy.map((column) => `${column} ${sortOrder.direction}`).toString();
    }
    return orderStr;
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
    options: { anchor?: string; bold?: boolean; color?: string; size?: number } = {},
  ): Text {
    return group
      .text(text)
      .font({
        size: options.size ?? this.styles.fontStyles.size,
        weight: options.bold ? "bold" : "normal",
        anchor: options.anchor ?? "start",
      })
      .fill(options.color ?? this.styles.fontStyles.color)
      .attr({ x, y, "font-family": this.fontFamily() });
  }

  private i18nMap: Map<string, string> = new Map();

  public setI18n(i18n: Map<string, string>): void {
    this.i18nMap = i18n;
  }

  public hasNoData(): boolean {
    return this.rows.length === 0;
  }

  /** Warnings collected during data resolution (bullet-* codes). */
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
    return (
      this.styles.padding.top +
      this.titleHeight() +
      this.headerHeight() +
      this.rows.length * this.rowBlockHeight() +
      this.styles.padding.bottom
    );
  }

  private titleHeight(): number {
    return this.config.chartTitle !== "" ? 1.6 * this.em : 0;
  }

  private headerHeight(): number {
    return this.rows.length > 0 ? 1.2 * this.em : 0;
  }

  private rowBlockHeight(): number {
    const em = this.em;
    const rowH = this.styles.scaleFactors.rowHeight * em;
    return this.normalized ? rowH : rowH + this.styles.scaleFactors.tickStripHeight * em;
  }

  private valueLabel(value: number | null): string {
    if (value === null || this.config.labels.show === "none") {
      return "";
    }
    return Formatter.number(value, "decimal", this.config.labels.decimals, 0, 1, this.styles.locale);
  }

  /**
   * Style family of the target marker, resolved through the rule set's
   * colorIndex so custom rule sets restyle the marker (10=AC solid,
   * 20=PP light, 30=FC dashed, 50=PL outlined).
   */
  private targetFamily(): string {
    const slot = this.config.target?.measure ?? "pl1";
    return styleSlot(this.ruleSet.getScenarioColorIndex(slot));
  }

  /** Measure label shown above the first row, e.g. "AC". */
  private actualLabel(): string {
    return this.config.actual.label ?? Formatter.translateScenarioLabel(this.config.actual.measure, this.i18nMap);
  }

  private targetLabel(): string {
    if (this.config.target === null) {
      return "";
    }
    if (this.config.target.label !== undefined) {
      return this.config.target.label;
    }
    if (this.normalized) {
      return this.i18nMap.get("target") || "Target";
    }
    return Formatter.translateScenarioLabel(this.config.target.measure, this.i18nMap);
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
    const em = this.em;
    const factors = this.styles.scaleFactors;
    const padding = this.styles.padding;
    const root = container.group();

    if (this.config.chartTitle !== "") {
      this.drawText(root, this.config.chartTitle, padding.left, padding.top + em, { bold: true });
    }

    if (this.rows.length === 0) {
      container.group().addClass("annotations");
      return;
    }

    const rowH = factors.rowHeight * em;
    const rowBlockH = this.rowBlockHeight();
    const rowsTop = padding.top + this.titleHeight() + this.headerHeight();
    const rowsBottom = rowsTop + (this.rows.length - 1) * rowBlockH + rowH;

    const labelColW = Math.max(...this.rows.map((row) => this.textWidth(row.category, true)), em);
    const valueTexts = this.rows.map((row) => this.valueLabel(row.actual));
    const valueColW =
      this.config.labels.show === "none" ? 0 : Math.max(...valueTexts.map((text) => this.textWidth(text)), 0);

    const plotX = padding.left + labelColW + factors.labelToAxis * em;
    const plotW = Math.max(
      10,
      this.availableWidth - plotX - padding.right - valueColW - (valueColW > 0 ? factors.labelToBar * em : 0),
    );

    // Header: unit once ("in EUR k") and the measure label above the first row's bar.
    const unit = this.config.actual.unit ?? this.config.target?.unit;
    const inWord = this.i18nMap.get("axis.in") || "in";
    const headerBaseline = rowsTop - 0.35 * em;
    if (unit !== undefined && unit !== "") {
      this.drawText(root, `${inWord} ${unit}`, padding.left, headerBaseline, {});
    }
    this.drawText(root, this.actualLabel(), plotX + 0.2 * em, headerBaseline, {});

    if (this.normalized) {
      this.drawNormalized(root, plotX, plotW, rowsTop, rowsBottom, rowH, rowBlockH, valueTexts);
    } else {
      this.drawClassic(root, plotX, plotW, rowsTop, rowH, rowBlockH, valueTexts);
    }

    // Category labels and the shared baseline at x = 0.
    this.rows.forEach((row, index) => {
      const cy = rowsTop + index * rowBlockH + rowH / 2;
      this.drawText(root, row.category, plotX - factors.labelToAxis * em, cy + 0.35 * em, {
        anchor: "end",
        bold: true,
      });
    });

    root
      .line(plotX, rowsTop - 0.2 * em, plotX, rowsBottom + 0.2 * em)
      .stroke({ color: this.styles.axisStyles.ac.stroke, width: strokeWidthPx(factors.axisLineWidth, this.em) });

    // Stable, empty hook for a future annotation layer.
    container.group().addClass("annotations");
  }

  /** Default IBCS mode: shared fraction-of-target scale, one continuous target line, variance bars. */
  private drawNormalized(
    root: G,
    plotX: number,
    plotW: number,
    rowsTop: number,
    rowsBottom: number,
    rowH: number,
    rowBlockH: number,
    valueTexts: string[],
  ): void {
    const em = this.em;
    const factors = this.styles.scaleFactors;

    const maxFraction = Math.max(1, ...this.rows.map((row) => row.fraction ?? 0));
    const span = maxFraction * 1.05;
    const x = (fraction: number): number => plotX + (fraction / span) * plotW;
    const targetX = x(1);

    // One continuous target line across all rows, styled by the target family.
    const targetStyle = this.styles.barStyles.getSVGStyle(this.targetFamily());
    const targetLine = root
      .line(targetX, rowsTop - 0.3 * em, targetX, rowsBottom + 0.3 * em)
      .stroke({ color: targetStyle.stroke, width: strokeWidthPx(factors.targetLineWidth, this.em) });
    if (targetStyle.dasharray !== undefined) {
      targetLine.attr("stroke-dasharray", targetStyle.dasharray);
    }
    this.drawText(root, this.targetLabel(), targetX, rowsTop - 0.35 * em, { anchor: "middle", bold: true });

    this.rows.forEach((row, index) => {
      const cy = rowsTop + index * rowBlockH + rowH / 2;

      if (row.fraction === null) {
        // Not normalizable (missing/invalid target or negative actual): value text only.
        this.drawValueText(root, valueTexts[index], plotX + factors.labelToBar * em, cy, row);
        return;
      }

      const barH = factors.barHeight * em;
      const barEnd = x(row.fraction);
      root
        .rect(Math.max(0, barEnd - plotX), barH)
        .move(plotX, cy - barH / 2)
        .fill(this.styles.barStyles.ac.fill)
        .stroke({ color: this.styles.barStyles.ac.stroke, width: this.styles.barStyles.ac.width })
        .attr(dataPointAttributes(this.rowKey(row), "element"));

      if (this.config.showVariances && row.sentiment !== "neu") {
        const varianceH = factors.varianceHeight * em;
        const varianceStyle = this.styles.varianceStyles.getSVGStyle(row.sentiment);
        root
          .rect(Math.abs(barEnd - targetX), varianceH)
          .move(Math.min(barEnd, targetX), cy - varianceH / 2)
          .fill(varianceStyle.fill)
          .stroke({ color: varianceStyle.stroke, width: varianceStyle.width });
      }

      this.drawValueText(root, valueTexts[index], Math.max(barEnd, targetX) + factors.labelToBar * em, cy, row);
    });
  }

  /** Classic mode: per-row scales with tick strips, target ticks, optional range bands. */
  private drawClassic(
    root: G,
    plotX: number,
    plotW: number,
    rowsTop: number,
    rowH: number,
    rowBlockH: number,
    valueTexts: string[],
  ): void {
    const em = this.em;
    const factors = this.styles.scaleFactors;
    const barH = factors.barHeight * em;
    const drawRanges = this.config.ranges.length > 0;

    this.rows.forEach((row, index) => {
      const rowTop = rowsTop + index * rowBlockH;
      const cy = rowTop + rowH / 2;
      const bandEnds = drawRanges && row.target !== null ? this.config.ranges.map((r) => r * row.target!) : [];
      const rowMax = Math.max(row.actual ?? 0, row.target ?? 0, ...bandEnds);

      if (rowMax <= 0) {
        this.drawValueText(root, valueTexts[index], plotX + factors.labelToBar * em, cy, row);
        return;
      }

      const step = NumericScale.niceStep(rowMax, 4);
      const niceMax = Math.ceil(rowMax / step - step * 1e-9) * step;
      const scale = new NumericScale(0, niceMax, plotX, plotX + plotW);

      // Qualitative range bands, behind everything: darker [0, r1·t], lighter [r1·t, r2·t].
      let bandStart = plotX;
      bandEnds.forEach((end, bandIndex) => {
        const bandH = rowH * 0.8;
        root
          .rect(Math.max(0, scale.scale(end) - bandStart), bandH)
          .move(bandStart, cy - bandH / 2)
          .fill(this.styles.rangeColors[Math.min(bandIndex, this.styles.rangeColors.length - 1)])
          .stroke("none");
        bandStart = scale.scale(end);
      });

      let rowRight = plotX;
      if (row.actual !== null && row.actual > 0) {
        const barEnd = scale.scale(row.actual);
        root
          .rect(barEnd - plotX, barH)
          .move(plotX, cy - barH / 2)
          .fill(this.styles.barStyles.ac.fill)
          .stroke({ color: this.styles.barStyles.ac.stroke, width: this.styles.barStyles.ac.width })
          .attr(dataPointAttributes(this.rowKey(row), "element"));
        rowRight = barEnd;
      }

      if (row.target !== null && row.target > 0) {
        const tickX = scale.scale(row.target);
        const tickH = factors.targetTickHeight * em;
        const targetStyle = this.styles.barStyles.getSVGStyle(this.targetFamily());
        const tick = root
          .line(tickX, cy - tickH / 2, tickX, cy + tickH / 2)
          .stroke({ color: targetStyle.stroke, width: strokeWidthPx(factors.targetLineWidth, this.em) });
        if (targetStyle.dasharray !== undefined) {
          tick.attr("stroke-dasharray", targetStyle.dasharray);
        }
        if (index === 0) {
          this.drawText(root, this.targetLabel(), tickX, rowsTop - 0.35 * em, { anchor: "middle" });
        }
        rowRight = Math.max(rowRight, tickX);
      }

      rowRight = Math.max(rowRight, bandStart);
      this.drawValueText(root, valueTexts[index], rowRight + factors.labelToBar * em, cy, row);

      // Per-row tick strip below the band.
      const ticks = scale.ticks(4);
      const decimals = NumericScale.tickDecimals(ticks);
      const tickTop = rowTop + rowH;
      for (const tick of ticks) {
        const tickX = scale.scale(tick);
        root
          .line(tickX, tickTop, tickX, tickTop + factors.axisTickLength * em)
          .stroke({ color: this.styles.axisStyles.ac.stroke, width: strokeWidthPx(factors.axisLineWidth, this.em) });
        this.drawText(
          root,
          Formatter.number(tick, "decimal", decimals, decimals, 1, this.styles.locale),
          tickX,
          tickTop + factors.tickStripHeight * em - 0.2 * em,
          { anchor: "middle" },
        );
      }
    });
  }

  private drawValueText(root: G, text: string, x: number, cy: number, row: BulletRowModel): void {
    if (text === "") {
      return;
    }
    this.drawText(root, text, x, cy + 0.35 * this.em, {}).attr(dataPointAttributes(this.rowKey(row), "label"));
  }

  /** The row of a bullet: its value of the chart's level and the actual measure. */
  private rowKey(row: BulletRowModel): DataPointKey {
    return { ...levelKey(this.config.level, row.category), scenario: this.config.actual.measure };
  }
}
