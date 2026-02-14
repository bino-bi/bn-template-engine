export enum I18nMode {
    ALL = "all",
    META = "meta"
}

export enum MeasureType {
    CURRENCY = "currency",
    VOLUME = "volume",
}



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

export enum Sentiments {
    POS = 'pos',
    NEG = 'neg',
    NEU = 'neu',
}

export enum DataFormat {
    DECIMAL = 'decimal',
    PERCENT = 'percent',
}

export enum TableType {
    LIST = "list",
    SUM = "sum",
    SUMNOTOTAL = "sumnototal",
    OPT = "opt",
    OPTNOTOTAL = "optnototal"
}

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

/* Enums */


export enum AggregationLevel {
    ROWGROUP = "rowGroup",
    ROWGROUPINDEX = "rowGroupIndex",
    CATEGORY = "category",
    CATEGORYINDEX = "categoryIndex",
    SUBCATEGORY = "subCategory",
    SUBCATEGORYINDEX = "subCategoryIndex",
}

export enum AxisLabelsMode {
    SMART = "smart",
    LONG = "long",
    SHORT = "short",
}

export enum ChartType {
    COLUMN = "column",
    LINE = "line",
    WATERFALL = "waterfall",
}

export enum ChartMode {
    BAR = "bar",
    LINE = "line",
    AUTO = "auto",
}

export enum StackBy {
    SCENARIO = "scenario",
    CATEGORY = "category",
    SUBCATEGORY = "subcategory",
    ROWGROUP = "rowgroup",
}

export enum StackMode {
    ABSOLUTE = "absolute",
    RELATIVE = "relative",
    ABSOLUTE_RELATIVE = "absolute-relative",
}

export enum StackOrder {
    ASC = "asc",
    DESC = "desc",
    DATASET = "dataset",
}

