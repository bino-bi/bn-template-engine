/** Controls which parts of a component are translated: ALL=labels+data, META=labels only. */
export enum I18nMode {
  ALL = "all",
  META = "meta",
}

/** Unit type of the measured values - affects default formatting and SI prefix behavior. */
export enum MeasureType {
  CURRENCY = "currency",
  VOLUME = "volume",
}

/**
 * IBCS four-scenario model with up to 4 variants per type.
 * - AC (actual): reported/measured values
 * - PP (previous period): prior year or period for comparison
 * - FC (forecast): projected future values
 * - PL (plan): budgeted/target values
 */
export enum Scenarios {
  AC1 = "ac1",
  AC2 = "ac2",
  AC3 = "ac3",
  AC4 = "ac4",
  PP1 = "pp1",
  PP2 = "pp2",
  PP3 = "pp3",
  PP4 = "pp4",
  FC1 = "fc1",
  FC2 = "fc2",
  FC3 = "fc3",
  FC4 = "fc4",
  PL1 = "pl1",
  PL2 = "pl2",
  PL3 = "pl3",
  PL4 = "pl4",
}

/**
 * Variance direction for IBCS traffic-light coloring.
 * - POS: favorable variance (green in IBCS)
 * - NEG: unfavorable variance (red in IBCS)
 * - NEU: neutral / no directional meaning
 * - OP: follows the row operation, like POS on "+" and "=" rows, like NEG on "-" rows
 *   (only in opt/optnototal tables, elsewhere the values are signed and OP equals POS)
 * - OPINV: the inverse of OP
 */
export enum Sentiments {
  POS = "pos",
  NEG = "neg",
  NEU = "neu",
  OP = "op",
  OPINV = "opinv",
}

/** Number display format: DECIMAL for absolute values, PERCENT for ratio columns. */
export enum DataFormat {
  DECIMAL = "decimal",
  PERCENT = "percent",
}

/**
 * Table aggregation mode.
 * - LIST: no aggregation, rows displayed as-is
 * - SUM: simple sum per group with a grand total row
 * - SUMNOTOTAL: sum per group without a grand total
 * - OPT: operation-aware aggregation - rows with operation="-" subtract from the group sum
 * - OPTNOTOTAL: operation-aware aggregation without a grand total
 */
export enum TableType {
  LIST = "list",
  SUM = "sum",
  SUMNOTOTAL = "sumnototal",
  OPT = "opt",
  OPTNOTOTAL = "optnototal",
}

/** Width of the category label column, in em of the table font. INF = auto/infinite. */
export enum TableCategoryWidth {
  INF = "inf",
  W100 = "w100",
  W50 = "w50",
  W25 = "w25",
  W20 = "w20",
  W15 = "w15",
  W10 = "w10",
  W5 = "w5",
}

/** Width preset for inline bar/pin chart columns. Value = total column width in em. */
export enum TableBarColumnWidth {
  W5 = "w5",
  W10 = "w10",
  W15 = "w15",
  W20 = "w20",
  W25 = "w25",
  W30 = "w30",
  W40 = "w40",
  W60 = "w60",
  W80 = "w80",
  W100 = "w100",
}

/** Maps TableBarColumnWidth presets to total bar column width in em. */
export const BAR_COLUMN_WIDTH_EM: Record<TableBarColumnWidth, number> = {
  [TableBarColumnWidth.W5]: 5,
  [TableBarColumnWidth.W10]: 10,
  [TableBarColumnWidth.W15]: 15,
  [TableBarColumnWidth.W20]: 20,
  [TableBarColumnWidth.W25]: 25,
  [TableBarColumnWidth.W30]: 30,
  [TableBarColumnWidth.W40]: 40,
  [TableBarColumnWidth.W60]: 60,
  [TableBarColumnWidth.W80]: 80,
  [TableBarColumnWidth.W100]: 100,
};

/**
 * Three-level row hierarchy for grouping and drill-down: rowGroup > category > subCategory.
 * Index variants (e.g. ROWGROUPINDEX) provide stable numeric sort keys that preserve
 * the original dataset order when alphabetical sorting is undesirable.
 */
export enum AggregationLevel {
  ROWGROUP = "rowGroup",
  ROWGROUPINDEX = "rowGroupIndex",
  CATEGORY = "category",
  CATEGORYINDEX = "categoryIndex",
  SUBCATEGORY = "subCategory",
  SUBCATEGORYINDEX = "subCategoryIndex",
}

/**
 * Date axis label display strategy.
 * - SMART: abbreviated labels with parent period shown at boundary crossings (e.g. "Jan" normally, "Jan 2024" at year boundary)
 * - LONG: full date format for every label
 * - SHORT: abbreviated format for every label
 * - TWO_ROW: abbreviated labels, and the parent period (the year of a month) in a second row where it starts
 */
export enum AxisLabelsMode {
  SMART = "smart",
  LONG = "long",
  SHORT = "short",
  TWO_ROW = "two-row",
}

/**
 * Visual representation type for chart series.
 * - COLUMN: vertical bars (time chart) or horizontal bars (structure chart)
 * - LINE: connected data points
 * - WATERFALL: cumulative flow where each bar starts where the previous one ended
 */
export enum ChartType {
  COLUMN = "column",
  LINE = "line",
  WATERFALL = "waterfall",
}

/** Chart rendering mode. AUTO selects BAR or LINE based on scenario type. */
export enum ChartMode {
  BAR = "bar",
  LINE = "line",
  AUTO = "auto",
}

/**
 * Stacking dimension for multi-segment bar charts.
 * - SCENARIOS: stack the scenarios from the `scenarios` prop end-to-end
 * - DIMENSIONS: stack by the next-lower hierarchy level derived from the `level` prop
 *   (rowGroup → category, category → subCategory)
 */
export enum StackBy {
  SCENARIOS = "scenarios",
  DIMENSIONS = "dimensions",
}

/**
 * How stacked values are presented.
 * - ABSOLUTE: raw values stacked
 * - RELATIVE: normalized to 100% per data point
 * - ABSOLUTE_RELATIVE: absolute bars with a relative (%) total label
 */
export enum StackMode {
  ABSOLUTE = "absolute",
  RELATIVE = "relative",
  ABSOLUTE_RELATIVE = "absolute-relative",
}

/**
 * Value domain of a RELATIVE (100%) stack: the full stack spans 100 units,
 * so pixelPerUnit is interpreted as pixels per percentage point.
 */
export const RELATIVE_STACK_UNITS = 100;

/** Sort order of segments within a stacked bar. DATASET preserves the original data order. */
export enum StackOrder {
  ASC = "asc",
  DESC = "desc",
  DATASET = "dataset",
}
