import { Order } from "../../../../../components";
import { DataFormat, I18nMode, TableCategoryWidth, MeasureType } from "../../../../../utils/constants";
import { DataAnalyzer } from "../../../../../utils/dataAnalyzer";
import { AdapterUtils } from "../../../../../utils/helper/AdapterUtils";
import { CompareUtil } from "../../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../../utils/helper/IAdapter";
import { StringAdapter } from "../../../../../utils/helper/StringAdapter";
import { OrderAdapter } from "../../../../../utils/model/Order";
import { SiPrefix } from "../../../../../utils/model/SiPrefix";
import { TableType } from "./index";
// import { IAdapter } from "../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../utils/helper/CompareUtil";
// import { AdapterUtils } from "../../../../utils/helper/AdapterUtils";
// import { Order, OrderAdapter } from "../../../../utils/model/Order";
// import { StringAdapter } from "../../../../utils/helper/StringAdapter";
import { TableDrillGroup, TableDrillGroupAdapter } from "./TableDrillGroup";
// import { DataAnalyzer } from "../../../../utils/dataAnalyzer";
// import { SiPrefix } from "../../../../utils/model/SiPrefix";
// import {DataFormat, I18nMode, MeasureType, TableCategoryWidth} from "@bino-bi/ibcs-component-interface";

export class TableComponentConfig {
  public title: string = "";
  public scenarios: string[] = [];
  public scenariosUnitType: DataFormat = DataFormat.DECIMAL;
  public grouped: boolean = false;
  public showGroupTitle: boolean = true;
  public thereOf: TableDrillGroup[] = [];
  public categoryThereOf: Map<string, any> = new Map();
  public partOf: TableDrillGroup[] = [];
  public order: Order = new OrderAdapter(new StringAdapter()).default();   // FIXME Rename to sortOrder
  public type: TableType = TableType.LIST;
  public limit: number = 0;
  public i18n: I18nMode = I18nMode.ALL;
  public categoryWidth: TableCategoryWidth = TableCategoryWidth.W25;
  public measureScale: SiPrefix = new SiPrefix();
  public measureUnit: string = "";
  public measureType: MeasureType = MeasureType.VOLUME;
  public showMeasureScale: boolean = true;
  public filter: string = "";
  constructor() { }

}

export class TableComponentConfigAdapter implements IAdapter<TableComponentConfig> {
  constructor(private tableDrillGroupAdapter: TableDrillGroupAdapter,
    private stringAdapter: StringAdapter,
    private orderAdapter: OrderAdapter,
    private dataSet: any[]) {
  }
  adapt(data: any): TableComponentConfig {
    const config = new TableComponentConfig();

    if (CompareUtil.isString(data.title)) {
      config.title = data.title;
    }

    if (CompareUtil.isArray(data.scenarios)) {
      config.scenarios = AdapterUtils.adaptArray(data.scenarios, this.stringAdapter);
    }

    if (CompareUtil.isExisting(data.scenariosUnitType)) {
      config.scenariosUnitType = data.scenariosUnitType;
    }

    if (CompareUtil.isBoolean(data.grouped)) {
      config.grouped = data.grouped;
    }

    if (CompareUtil.isBoolean(data.showGroupTitle)) {
      config.showGroupTitle = data.showGroupTitle;
    }
    
    if (CompareUtil.isBoolean(data.showMeasureScale)) {
      config.showMeasureScale = data.showMeasureScale;
    }

    if (CompareUtil.isArray(data.thereOf)) {
      config.thereOf = AdapterUtils.adaptArray(data.thereOf, this.tableDrillGroupAdapter);
    }

    if (CompareUtil.isExisting(data.categoryThereOf)) {
      config.categoryThereOf = data.categoryThereOf;
    }


    if (CompareUtil.isArray(data.partOf)) {
      config.partOf = AdapterUtils.adaptArray(data.partOf, this.tableDrillGroupAdapter);
    }


    if (CompareUtil.isExisting(data.order)) {
      config.order = this.orderAdapter.adapt(data.order);
    }

    if (CompareUtil.isExisting(data.type)) {
      config.type = data.type;
    }

    if (CompareUtil.isNumber(data.limit)) {
      config.limit = data.limit
    }

    if (CompareUtil.isExisting(data.i18n)) {
      config.i18n = data.i18n;
    }

    if (CompareUtil.isExisting(data.categoryWidth)) {
      config.categoryWidth = data.categoryWidth;
    }

    if (CompareUtil.isExisting(data.measureScale)) {
      config.measureScale = DataAnalyzer.calculateMeasureScale(this.dataSet, config.scenarios, data.measureScale);
    }

    if (CompareUtil.isExisting(data.measureType)) {
      config.measureType = data.measureType;
    }

    if (CompareUtil.isString(data.measureUnit)) {
      config.measureUnit = data.measureUnit;
    }

    if (CompareUtil.isString(data.filter)) {
      config.filter = data.filter.trim();
    }

    return config;
  }

  default(): TableComponentConfig {
    return new TableComponentConfig();
  }

}
