export interface DimensionMeta {
  distinctValues: string[];
  count: number;
  hasData: boolean;
}

export interface ScenarioMeta {
  key: string;
  hasData: boolean;
  min: number | null;
  max: number | null;
}

export interface DateRangeMeta {
  min: string | null;
  max: string | null;
  hasData: boolean;
  distinctCount: number;
}

export interface DatasetMeta {
  rowCount: number;
  scenarios: ScenarioMeta[];
  availableScenarios: string[];
  rowGroup: DimensionMeta;
  category: DimensionMeta;
  subCategory: DimensionMeta;
  columnGroup: DimensionMeta;
  columnSubGroup: DimensionMeta;
  dateRange: DateRangeMeta;
  suggestedLevel: string;
  suggestedOrder: string;
  suggestedDateInterval: string | null;
  calculatedAt: number;
}
