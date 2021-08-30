import {Component, h, Host, Prop, State, Watch} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import {
  isBlankInput,
  isTableCategoryWidth,
  isValidBoolean,
  isValidDataFormat,
  isValidDirection,
  isValidi18nMode, isValidMeasureType,
  isValidInteger,
  isValidTableType,
  validateI18nString,
  validateOrderList,
  validatePartOfJsonStr,
  validateScenarioList,
  validateThereOfJsonStr, isValidMeasureScale
} from "../../utils/validate";

import {
  DataFormat,
  DataFormatDigits,
  I18nMode, MeasureType,
  Order,
  OrderColumn,
  OrderDirection,
  TableCategoryWidth,
  TableDrillGroup,
  TableType
} from "@bino-bi/ibcs-component-interface";
import {TablePartGroup} from "@bino-bi/ibcs-component/dist/types/components/ibcs-table/utils/model";
import {DataRow} from "@bino-bi/ibcs-component/dist/types/components/ibcs-chart-structure/utils/model";
import withDataset from "../../utils/withDataset";


@Component({
  tag: 'bn-table',
  styleUrl: 'bn-table.css'
})
export class Table {

  @State() data: DataRow[] = []

  constructor() {
    withDataset(this, (_name, data) => {
      this.data = data || [];
    });
  }

  /**
   * A not mundane tile for the shard,
   * which describes the shown data.
   */
  @Prop() tableTitle!: string;


  /**
   * (optional) List of scenarios. Valid scenarios are
   *
   *  variances pattern d<scenario_baseScenario>
   *  relative variance pattern dr<scenario_baseScenario>
   *
   *  values: ac | fc | pp | pl | dfc_ac | drfc_ac
   */
  @Prop() readonly scenarios!: string;

  @Watch('scenarios')
  validateScenario(newValue: string) {
    const invalidScenarios: string[] = validateScenarioList(newValue);
    if (invalidScenarios.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.');
    }
  }


  /**
   * (optional) Scenario Unit Type
   *
   *  percent all data values are converted into percent
   *  (0.02 ->  2%)
   *
   *  default volume
   *  values: percent | decimal
   */
  @Prop() dataFormat!: string;

  @Watch('dataFormat')
  validateDataFormat(newValue: string) {
    if (!isValidDataFormat(newValue)) {
      throw new Error('dataFormat: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   *  Toggles of data should be grouped by
   *  'rowgroup'.
   *
   *  values: true | false
   *  default: true
   */
  @Prop() grouped!: boolean | string;

  @Watch('grouped')
  validateGrouped(newValue: string | boolean) {
    if (!isValidBoolean(newValue)) {
      throw new Error('grouped: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   *  Toggles a title header for each (row-)group
   *  the title header value is found set by 'rowgroup'
   *
   *  values: true | false
   *  default: true
   *
   */
  @Prop() showGroupTitle!: boolean | string;

  @Watch('showGroupTitle')
  validateShowGroupTitle(newValue: string | boolean) {
    if (!isValidBoolean(newValue)) {
      throw new Error('showGroupTitle: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   *  Set the table type
   *
   *  list | sum | opt | sumnototal | optnototal
   *
   */
  @Prop() type!: string;

  @Watch('type')
  validateType(newValue: string | boolean) {
    if (!isValidTableType(newValue)) {
      throw new Error('type: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   * (optional) Set the maximum number of rows for each
   * group. The value 0 means *no limit*
   *
   * rows wich where cut by the limit are cumulated as REST
   *
   */
  @Prop() limit: number = 0;

  @Watch('limit')
  validateLimit(newValue: number) {
    if (!isValidInteger(newValue)) {
      throw new Error('order: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }
  }


  /**
   * (optional) stringified Array of drilldown Objects {
            "rowgroup": string,
            "category": string,
            "subcategory": string,
          },
   * rowgroup, categroy defines the location of the drill
   * subcategory is the displayed label of the data row
   *
   * example: [{
   "rowgroup":"Umsatz",
   "category": "Applications",
   "subcategory": "Applications-A",
   },]
   */
  @Prop() thereof: string = '[]';

  @Watch('thereof')
  validateThereOf(newValue: string) {
    const invalidElements: string[] = validateThereOfJsonStr(newValue);
    if (invalidElements.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.');
    }
  }

  /**
   * (optional) stringified Array of Partof Objects {
            "rowgroup": string,
            "category": string
          },
   * rowgroup, categroy defines the location of the drill
   * percentage of category in rowgorup
   *
   * example: [{
   "rowgroup":"Umsatz",
   "category": "Applications",
   },]
   */
  @Prop() partof: string = '[]';

  @Watch('partof')
  validatePartOf(newValue: string) {
    const invalidElements: string[] = validatePartOfJsonStr(newValue);
    if (invalidElements.length > 0) {
      throw new Error('scenarios: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.');
    }
  }


  /** List of the primary scenarios on which the order direction are applied  valid scenarios are
   *  If order is set to a scenario it has also exists in scenariolist
   *
   *  values: category | categoryindex | rowgroup | rowgroup | rowgroupindex | ac | fc | pp | pl
   */
  @Prop() order!: string;

  @Watch('order')
  validateOrderList(newValue: string) {
    const invalidElements: string[] = validateOrderList(newValue);
    if (invalidElements.length > 0) {
      throw new Error('order: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.');
    }
  }


  /** set sorting order directon
   *
   * values: asc | desc
   */
  @Prop() orderDirection!: string;

  /** set translaton mode.
   *
   * values:   all | none | meta
   */

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) {
      throw new Error('orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }

  }

  /** Sets the Measure Type of the Table
   *  volume is different displayed and interpreted as currency
   *  names of siprefix are adapted.
   *
   *  values: volume |currency
   *  default: currency
   */
  @Prop() measureType: string = "VOLUME";

  @Watch('measureType')
  validateMeasureType(newValue: string) {
    if (!isValidMeasureType(newValue)) {
      throw new Error('order: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }
  }

  /**
   * Sets the SiPrefix of the Mesaurements and converts the
   * original value.
   *
   *  values:  _ | k | M | G | T | P | E |Z |Y |m |μ | n | p |P | f | a |z |y | GREATEST |LEAST
   *  default: GREATEST
   *
   *  SiPrefix overview:
   *      "Y":  1E+24,
   *       "Z":  1E+21,
   *       "E":  1E+18,
   *       "P":  1E+15,
   *       "T":  1E+12,
   *       "G":  1000000000,
   *       "M":  1000000,
   *       "k":  1000,
   *
   *       "m":  0.001,
   *       "μ":  0.000001,
   *       "n":  0.000000001,
   *       "p":  0.000000000001,
   *       "f":  0.000000000000001,
   *       "a":  0.000000000000000001,
   *       "z":  0.000000000000000000001,
   *       "y":  0.000000000000000000000001,
   *
   * Special modes:
   * GREATEST seaches for the bigest (farest to zero) Value in the dataset and sets this value to SiPrefix
   * LEAST    searches for smallest (closest to zero) Value in the dataset and sets this value to SiPrefix
   *
   * _        is the value for no SiPrefix the value is displayed as in the dataset stored.
   *
   *
   */
  @Prop() measureScale: string = "GREATEST";

  @Watch('measureType')
  validateMeasureScale(newValue: string) {
    if (!isValidMeasureScale(newValue)) {
      throw new Error('order: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }
  }

  /**
   *  Mode of Translation,
   *
   *  values: none| meta| all
   *
   *  default: meta
   */
  @Prop() internationalisationMode: string = "meta";

  @Watch('internationalisationMode')
  validatei18nMode(newValue: string) {
    if (!isValidi18nMode(newValue)) {
      throw new Error('internationalisationMode: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }
  }


  @Prop() internationalisation?: string;

  @Watch('internationalisation')
  validateI18n(newValue: string) {
    if (!validateI18nString(newValue)) {
      throw new Error('internationalisation: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  @Prop() dataFormatDigitsDecimal?: number;

  @Watch('dataFormatDigitsDecimal')
  validateDataFormatDigitsDecimal(newValue: number) {
    if (!isValidInteger(newValue)) {
      throw new Error('dataFormatDigitsDecimal: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }


  @Prop() dataFormatDigitsPercent?: number;

  @Watch('dataFormatDigitsPercent')
  validateDateFormatDigitsPercent(newValue: number) {
    if (!isValidInteger(newValue)) {
      throw new Error('dataFormatDigitsPercent: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /** set width of category columns
   *
   * values: W5 | W10 | W15 | W20 | W25 | W50 | INF
   * default: W15
   */
  @Prop() categoryWidth?: string;

  @Watch('categoryWidth')
  validateCategoryWidth(newValue: string) {
    if (!isTableCategoryWidth(newValue)) {
      throw new Error('categoryWidth: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  unsubscribe: () => void

  componentWillLoad() {
    //this.datasouce = get("test");
    // this.unsubscribe = onChange("test", (value) => this.datasouce = value);

    this.validateScenario(this.scenarios);
    this.validateDataFormat(this.dataFormat);
    this.validateGrouped(this.grouped);
    this.validateShowGroupTitle(this.showGroupTitle);
    this.validateType(this.type);
    this.validateLimit(this.limit);
    this.validateThereOf(this.thereof);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validatei18nMode(this.internationalisationMode);
    this.validateI18n(this.internationalisation);
    this.validateDataFormatDigitsDecimal(this.dataFormatDigitsDecimal);
    this.validateDateFormatDigitsPercent(this.dataFormatDigitsPercent);
    this.validateCategoryWidth(this.categoryWidth);
    this.validateMeasureType(this.measureType);
    this.validateMeasureScale(this.measureScale);
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private prepareDataFormat(): DataFormat {
    return DataFormat[this.dataFormat?.toUpperCase() as keyof typeof DataFormat];
  }

  private prepareGrouped(): boolean {
    return (this.grouped == true || this.grouped == "true");
  }

  private prepareShowGroupTitle(): boolean {
    return (this.showGroupTitle == true || this.showGroupTitle == "true");
  }

  private prepareTableType(): TableType {
    return TableType[this.type?.toUpperCase() as keyof typeof TableType];
  }

  private prepareLimit(): number {
    return Math.floor(Number(this.limit) || 0);
  }

  private prepareThereOf(): TableDrillGroup[] {
    if (this.thereof == null || this.thereof.trim() == '') {
      return [];
    }

    return JSON.parse(this.thereof!) as TableDrillGroup[];

  }

  private preparePartOf(): TablePartGroup[] {
    if (this.partof == null || this.partof.trim() == '') {
      return [];
    }

    return JSON.parse(this.partof!) as TablePartGroup[];

  }


  private prepareOrder(): Order {
    const tableOrder: Order = {
      hierarchy: this.order.split(",").map(entry => OrderColumn[entry?.toUpperCase() as keyof typeof OrderColumn]),
      direction: OrderDirection[this.orderDirection?.toUpperCase() as keyof typeof OrderDirection]
    };

    return tableOrder;
  }

  private prepareI18nMode(): I18nMode {
    console.log("prepaer", this.internationalisationMode);
    return I18nMode[this.internationalisationMode?.trim().toUpperCase() as keyof typeof I18nMode];
  }

  private prepareI18n(): Map<string, string> {
    return new Map([]);
  }

  private prepareDataFormatDigits(): DataFormatDigits {
    const formatDigits: DataFormatDigits = {
      percent: this.dataFormatDigitsPercent,
      decimal: this.dataFormatDigitsDecimal
    };

    return formatDigits;
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios)) {
      return [];
    }
    return this.scenarios?.split(",").map(entry => entry.trim());
  }

  private prepareCategoryWidth(): TableCategoryWidth {
    if (isBlankInput(this.categoryWidth)) {
      return TableCategoryWidth.INF;
    }
    return TableCategoryWidth[this.categoryWidth?.toUpperCase() as keyof typeof TableCategoryWidth];
  }

  private prepareMeasureScale(): string {
    if (isBlankInput(this.measureScale)) {
      return "GREATEST";
    }

    if (['_', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'm', 'μ', 'n', 'p', 'P', 'f', 'a', 'z', 'y'].includes(this.measureScale.trim())) {
      return this.measureScale.trim();
    }

    if (this.measureScale.trim().toUpperCase() === 'LEAST') {
      return this.measureScale.trim();
    }

    return "GREATEST";
  }

  private prepareMeasureType(): string {
    if (isBlankInput(this.measureType)) {
      return MeasureType.VOLUME;
    }
    return MeasureType[this.measureType?.toUpperCase() as keyof typeof MeasureType];
  }

  render() {
    return <Host>
      <ibcs-table
        table-title={this.tableTitle}
        scenarios={this.prepareScenarios()}
        scenarios-data-format={this.prepareDataFormat()}
        grouped={this.prepareGrouped()}
        show-group-title={this.prepareShowGroupTitle()}
        type={this.prepareTableType()}
        limit={this.prepareLimit()}
        thereof={this.prepareThereOf()}
        partof={this.preparePartOf()}
        order={this.prepareOrder()}
        i18n-mode={this.prepareI18nMode()}
        i18n={this.prepareI18n()}
        data={this.data}
        dataFormatDigits={this.prepareDataFormatDigits()}
        category-width={this.prepareCategoryWidth()}
        measure-scale={this.prepareMeasureScale()}
        measure-type={this.prepareMeasureType()}
      ></ibcs-table>
    </Host>;
  }
}

styled(Table);
