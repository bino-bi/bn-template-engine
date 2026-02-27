import { DatasetMeta, DimensionMeta, ScenarioMeta, DateRangeMeta } from "./model/DatasetMeta";

const SCENARIO_KEYS = [
  "ac1",
  "ac2",
  "ac3",
  "ac4",
  "pp1",
  "pp2",
  "pp3",
  "pp4",
  "fc1",
  "fc2",
  "fc3",
  "fc4",
  "pl1",
  "pl2",
  "pl3",
  "pl4",
];

const DIMENSION_FIELDS = ["rowGroup", "category", "subCategory", "columnGroup", "columnSubGroup"] as const;

function isNumericValue(val: any): val is number {
  return typeof val === "number" && !isNaN(val) && isFinite(val);
}

function buildDimensionMeta(values: Set<string>): DimensionMeta {
  const distinctValues = Array.from(values);
  return {
    distinctValues,
    count: distinctValues.length,
    hasData: distinctValues.length > 0,
  };
}

export function calculateDatasetMeta(data: any[]): DatasetMeta {
  const dimensionSets: Record<string, Set<string>> = {};
  for (const field of DIMENSION_FIELDS) {
    dimensionSets[field] = new Set<string>();
  }

  const scenarioStats: Record<string, { hasData: boolean; min: number | null; max: number | null }> = {};
  for (const key of SCENARIO_KEYS) {
    scenarioStats[key] = { hasData: false, min: null, max: null };
  }

  const dateSeen = new Set<string>();
  let dateMin: string | null = null;
  let dateMax: string | null = null;

  const rows = Array.isArray(data) ? data : [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row == null) continue;

    for (const field of DIMENSION_FIELDS) {
      const val = row[field];
      if (val != null && val !== "") {
        dimensionSets[field].add(String(val));
      }
    }

    for (const key of SCENARIO_KEYS) {
      const val = row[key];
      if (isNumericValue(val)) {
        const stat = scenarioStats[key];
        stat.hasData = true;
        if (stat.min === null || val < stat.min) stat.min = val;
        if (stat.max === null || val > stat.max) stat.max = val;
      }
    }

    const dateVal = row["date"];
    if (dateVal != null && dateVal !== "") {
      const dateStr = String(dateVal);
      dateSeen.add(dateStr);
      if (dateMin === null || dateStr < dateMin) dateMin = dateStr;
      if (dateMax === null || dateStr > dateMax) dateMax = dateStr;
    }
  }

  const scenarios: ScenarioMeta[] = SCENARIO_KEYS.map((key) => ({
    key,
    hasData: scenarioStats[key].hasData,
    min: scenarioStats[key].min,
    max: scenarioStats[key].max,
  }));

  const availableScenarios = scenarios.filter((s) => s.hasData).map((s) => s.key);

  const rowGroup = buildDimensionMeta(dimensionSets["rowGroup"]);
  const category = buildDimensionMeta(dimensionSets["category"]);
  const subCategory = buildDimensionMeta(dimensionSets["subCategory"]);
  const columnGroup = buildDimensionMeta(dimensionSets["columnGroup"]);
  const columnSubGroup = buildDimensionMeta(dimensionSets["columnSubGroup"]);

  const dateRange: DateRangeMeta = {
    min: dateMin,
    max: dateMax,
    hasData: dateSeen.size > 0,
    distinctCount: dateSeen.size,
  };

  let suggestedLevel = "category";
  if (subCategory.hasData) {
    suggestedLevel = "subCategory";
  } else if (category.hasData) {
    suggestedLevel = "category";
  } else if (rowGroup.hasData) {
    suggestedLevel = "rowGroup";
  }

  const suggestedOrder = suggestedLevel;
  const suggestedDateInterval = dateRange.hasData ? "auto" : null;

  return {
    rowCount: rows.length,
    scenarios,
    availableScenarios,
    rowGroup,
    category,
    subCategory,
    columnGroup,
    columnSubGroup,
    dateRange,
    suggestedLevel,
    suggestedOrder,
    suggestedDateInterval,
    calculatedAt: Date.now(),
  };
}
