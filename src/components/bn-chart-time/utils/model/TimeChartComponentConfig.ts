// import { IAdapter } from "../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../utils/helper/CompareUtil";
// import { StringAdapter } from "../../../../utils/helper/StringAdapter";
// import { Order, OrderAdapter } from "../../../../utils/model/Order";
// import { AdapterUtils } from "../../../../utils/helper/AdapterUtils";

import { AggregationLevel, AxisLabelsMode } from "../../../../utils/constants";
import { DataAnalyzer } from "../../../../utils/dataAnalyzer";
import { DateDistance } from "../../../../utils/DateStringFactory";
import { AdapterUtils } from "../../../../utils/helper/AdapterUtils";
import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";
import { StringAdapter } from "../../../../utils/helper/StringAdapter";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../../../utils/model/DataFormatDigits";
import { Order, OrderAdapter } from "../../../../utils/model/Order";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { TimeChartDataRow, TimeChartDataRowAdapter } from "./TimeChartDataRow";
// import {AggregationLevel, AxisLabelsMode, DateDistance, IDataFormatDigits} from "@bino-bi/ibcs-component-interface";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";
// import { DataFormatDigitsAdapter } from "../../../../utils/model/DataFormatDigits";
//import { DataAnalyzer } from "../../../../utils/dataAnalyzer";

export class TimeChartComponentConfig {
  public variances: string[] = [];
  public title: string = '';
  public hideAxisLabels: boolean = false;
  public pixelPerUnit: number = 10;
  public pixelPerPercentage: number = 50;
  public limit: number = 0;
  public sortOrder: Order = new OrderAdapter(new StringAdapter()).default();
  public level: AggregationLevel = AggregationLevel.CATEGORY;
  public leftSideOffsetForHorizontalSync: number = -1;
  public dateInterval: DateDistance = DateDistance.AUTO;
  public axisLabelsMode: AxisLabelsMode = AxisLabelsMode.SMART;
  public intervalSpanLimit: number = 28;
  public filter: string = "";
  public measureScale: SiPrefix = new SiPrefix();
  public measureUnit: string = "";  
  public showMeasureScale: boolean = true;
  public dataFormatDigits: DataFormatDigits = {decimal: 1, percent: 2};
  public medianAvg: string[] = [];
  public medianMedian: string[] = [];
  public showOverlayMedian: boolean = true;
  public showOverlayAvg: boolean = true;
  constructor(public data: TimeChartDataRow[],
    public scenarios: string[],
  ) {

  }
}

export class TimeChartComponentConfigAdapter implements IAdapter<TimeChartComponentConfig> {
  constructor(private dataRowAdapter: TimeChartDataRowAdapter,
    private orderAdapter: OrderAdapter,
    private stringAdapter: StringAdapter,
    private dataFormatDigitsAdapter: DataFormatDigitsAdapter,
    private dataSet: any[]) {
  }

  adapt(data: any): TimeChartComponentConfig {
    const dataSet: TimeChartDataRow[] = AdapterUtils.adaptArray(data.data, this.dataRowAdapter);
    const scenarios: string[] = AdapterUtils.adaptArray(data.scenarios, this.stringAdapter);

    const config: TimeChartComponentConfig = new TimeChartComponentConfig(dataSet, scenarios);

    if (CompareUtil.isArray(data.variances)) {
      config.variances = AdapterUtils.adaptArray(data.variances, this.stringAdapter);
    }

    if (CompareUtil.isString(data.title)) {
      config.title = data.title;
    }

    if (CompareUtil.isBoolean(data.hideAxisLabels)) {
      config.hideAxisLabels = data.hideAxisLabels
    }

    if (CompareUtil.isNumber(data.pixelPerUnit)) {
      config.pixelPerUnit = data.pixelPerUnit
    }

    if (CompareUtil.isNumber(data.pixelPerPercentage)) {
      config.pixelPerPercentage = data.pixelPerPercentage
    }

    if (CompareUtil.isNumber(data.limit)) {
      config.limit = data.limit
    }

    if (CompareUtil.isExisting(data.sortOrder)) {
      config.sortOrder = this.orderAdapter.adapt(data.sortOrder);
    }

    if (CompareUtil.isExisting(data.level)) {
      config.level = data.level;
    }

    if (CompareUtil.isExisting(data.dateInterval)) {
      config.dateInterval = data.dateInterval;
    }

    if (CompareUtil.isExisting(data.axisLabelsMode)) {
      config.axisLabelsMode = data.axisLabelsMode;
    }

    if (CompareUtil.isNumber(data.leftSideOffsetForHorizontalSync)) {
      config.leftSideOffsetForHorizontalSync = data.leftSideOffsetForHorizontalSync;
    }

    if (CompareUtil.isNumber(data.intervalSpanLimit)) {
      config.intervalSpanLimit = data.intervalSpanLimit;
    }

    if (CompareUtil.isString(data.filter)) {
      config.filter = data.filter;
    }

    if (CompareUtil.isExisting(data.measureScale)) {
      config.measureScale = DataAnalyzer.calculateMeasureScale(this.dataSet, config.scenarios, data.measureScale);
    }

    if (CompareUtil.isString(data.measureUnit)) {
      config.measureUnit = data.measureUnit;
    }

    if (CompareUtil.isBoolean(data.showMeasureScale)) {
      config.showMeasureScale = data.showMeasureScale
    }

    if (CompareUtil.isExisting(data.dataFormatDigits)) {
      config.dataFormatDigits = this.dataFormatDigitsAdapter.adapt(data.dataFormatDigits);
    }
    
    if (CompareUtil.isArray(data.medianAvg)) {
      config.medianAvg = AdapterUtils.adaptArray(data.medianAvg, this.stringAdapter);
    }

    if (CompareUtil.isArray(data.medianMedian)) {
      config.medianMedian = AdapterUtils.adaptArray(data.medianMedian, this.stringAdapter);
    }

    return config;
  }
  default() {
    return new TimeChartComponentConfig([], []);
  }
}
