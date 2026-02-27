import { I18nMode } from "../../../../../utils/constants";
import { AdapterUtils } from "../../../../../utils/helper/AdapterUtils";
import { CompareUtil } from "../../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../../utils/helper/IAdapter";
import { StringAdapter } from "../../../../../utils/helper/StringAdapter";
import { Order, OrderAdapter } from "../../../../../utils/model/Order";
import { MeasureEntry, MeasureEntryAdapter } from "./MeasureEntriy";
import { TimePeriod, TimePeriodAdapter } from "./TimePeriod";

export class TitleConfig {
  businessunit: string = '';
  measures: MeasureEntry[] = [];
  scenarios: string[] = [];
  timeperiod: TimePeriod | undefined;
  i18nMode: I18nMode = I18nMode.ALL;
  order?: Order | undefined;
  intervalSpanLimit: number = 32;

  constructor() {
  }
}

export class TitleConifgAdapter implements IAdapter<TitleConfig> {
  constructor(private measureEntryAdapter: MeasureEntryAdapter,
    private timePeriodAdapter: TimePeriodAdapter,
    private orderAdapter: OrderAdapter,
    private stringAdapter: StringAdapter) {
  }

  adapt(data: any): TitleConfig {
    const config: TitleConfig = new TitleConfig();

    if (CompareUtil.isString(data.businessunit)) {
      config.businessunit = data.businessunit;
    }

    if (CompareUtil.isArray(data.measures)) {
      config.measures = AdapterUtils.adaptArray(data.measures, this.measureEntryAdapter);
    }

    if (CompareUtil.isArray(data.scenarios)) {
      config.scenarios = AdapterUtils.adaptArray(data.scenarios, this.stringAdapter);
    }


    if (CompareUtil.isExisting(data.timeperiod)) {
      config.timeperiod = this.timePeriodAdapter.adapt(data.timeperiod);
    }

    if (CompareUtil.isNumber(data.intervalSpanLimit)) {
      config.intervalSpanLimit = (data.intervalSpanLimit);
    }



    if (CompareUtil.isExisting(data.i18nMode)) {
      config.i18nMode = data.i18nMode;
    }

    if (CompareUtil.isExisting(data.order)) {
      config.order = this.orderAdapter.adapt(data.order);
    }

    return config;
  }

  default(): TitleConfig {
    return new TitleConfig();
  }
}
