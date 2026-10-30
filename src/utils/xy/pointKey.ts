import { DataPointKey } from "../layoutState/types";
import { FacetConfig } from "./model/AxisConfig";
import { GroupLevel, PointLevel, XYPoint } from "./model/XYChartDataRow";

/** The dimensions of one XY mark: its name, and its series and panel when the chart has them. */
export function xyPointKey(
  point: XYPoint,
  facetKey: string,
  config: { pointLevel: PointLevel; seriesLevel: GroupLevel | null; facet: FacetConfig | null },
): DataPointKey {
  const key: DataPointKey = { [config.pointLevel]: point.name };
  if (config.seriesLevel !== null && point.seriesKey !== "") key[config.seriesLevel] = point.seriesKey;
  if (config.facet !== null && facetKey !== "") {
    key[config.facet.level === "rowgroup" ? "rowGroup" : "category"] = facetKey;
  }
  return key;
}
