import { AggregationLevel, StackBy, StackMode, StackOrder } from "../../../../utils/constants";
import { DataAnalyzer } from "../../../../utils/dataAnalyzer";
import { AdapterUtils } from "../../../../utils/helper/AdapterUtils";
import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";
import { StringAdapter } from "../../../../utils/helper/StringAdapter";
import { DataFormatDigits, DataFormatDigitsAdapter } from "../../../../utils/model/DataFormatDigits";
import { Order, OrderAdapter } from "../../../../utils/model/Order";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { StructureChartDataRow, StructureChartDataRowAdapter } from "./StructureChartDataRow";

export interface StackConfigParsed {
  by: StackBy;
  mode: StackMode;
  order: StackOrder;
}

export class StructureChartComponentConfig {
  public variances: string[] = [];
  public title: string = "";
  public hideCategories: boolean = false;
  public pixelPerUnit: number = 10;
  public pixelPerPercentage: number = 50;
  public limit: number = 0;
  public sortOrder: Order = new OrderAdapter(new StringAdapter()).default();
  public level: AggregationLevel = AggregationLevel.CATEGORY;
  public filter: string = "";
  public measureScale: SiPrefix = new SiPrefix();
  public measureUnit: string = "";
  public showMeasureScale: boolean = true;
  public dataFormatDigits: DataFormatDigits = { decimal: 1, percent: 2 };
  public stackConfig: StackConfigParsed | null = null;

  constructor(
    public data: StructureChartDataRow[],
    public scenarios: string[],
  ) {}
}

export class StructureChartComponentConfigAdapter implements IAdapter<StructureChartComponentConfig> {
  constructor(
    private dataRowAdapter: StructureChartDataRowAdapter,
    private orderAdapter: OrderAdapter,
    private stringAdapter: StringAdapter,
    private dataFormatDigitsAdapter: DataFormatDigitsAdapter,
    private dataSet: any[],
  ) {}

  adapt(data: any): StructureChartComponentConfig {
    const dataSet: StructureChartDataRow[] = AdapterUtils.adaptArray(data.data, this.dataRowAdapter);
    const scenarios: string[] = AdapterUtils.adaptArray(data.scenarios, this.stringAdapter);

    const config: StructureChartComponentConfig = new StructureChartComponentConfig(dataSet, scenarios);

    if (CompareUtil.isArray(data.variances)) {
      config.variances = AdapterUtils.adaptArray(data.variances, this.stringAdapter);
    }

    if (CompareUtil.isString(data.title)) {
      config.title = data.title;
    }

    if (CompareUtil.isBoolean(data.hideCategories)) {
      config.hideCategories = data.hideCategories;
    }

    if (CompareUtil.isNumber(data.pixelPerUnit)) {
      config.pixelPerUnit = data.pixelPerUnit;
    }
    3;

    if (CompareUtil.isNumber(data.pixelPerPercentage)) {
      config.pixelPerPercentage = data.pixelPerPercentage;
    }

    if (CompareUtil.isNumber(data.limit)) {
      config.limit = data.limit;
    }

    if (CompareUtil.isExisting(data.sortOrder)) {
      config.sortOrder = this.orderAdapter.adapt(data.sortOrder);
    }

    if (CompareUtil.isExisting(data.level)) {
      config.level = data.level;
    }

    if (CompareUtil.isString(data.filter)) {
      config.filter = data.filter.trim();
    }

    if (CompareUtil.isExisting(data.measureScale)) {
      config.measureScale = DataAnalyzer.calculateMeasureScale(this.dataSet, config.scenarios, data.measureScale);
    }

    if (CompareUtil.isString(data.measureUnit)) {
      config.measureUnit = data.measureUnit;
    }

    if (CompareUtil.isBoolean(data.showMeasureScale)) {
      config.showMeasureScale = data.showMeasureScale;
    }

    if (CompareUtil.isExisting(data.dataFormatDigits)) {
      config.dataFormatDigits = this.dataFormatDigitsAdapter.adapt(data.dataFormatDigits);
    }

    if (CompareUtil.isExisting(data.stackConfig)) {
      config.stackConfig = data.stackConfig;
    }

    return config;
  }
  default() {
    return new StructureChartComponentConfig([], []);
  }
}
