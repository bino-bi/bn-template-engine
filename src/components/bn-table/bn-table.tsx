import {Component, h, Host, Prop, State, Watch} from "@stencil/core";
import {styled} from "../../utils/styled/styled";
import {
  isBlankInput,
  isTableCategoryWidth,
  isValidBoolean,
  isValidDataFormat,
  isValidDirection,
  isValidMeasureType,
  isValidInteger,
  isValidTableType,
  validateOrderList,
  validatePartOfJsonStr,
  validateScenarioList,
  validateThereOfJsonStr, isValidMeasureScale, validateCategoryThereOfJsonStr
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
import withComponentStatus from "../../utils/withComponentStatus";
import {globalLabelKeys} from "../../stores/internationalization";
import withTranslation from "../../utils/withTranslation";


@Component({
  tag: 'bn-table',
  styleUrl: 'bn-table.css'
})
export class Table {
  private readonly t: (key: string, data?: object) => string;

  @State() data: DataRow[] = []


  constructor() {
    withComponentStatus(this);
    withDataset(this, (_name, data) => {
      this.data = data || [];
    });

    this.t = withTranslation(this).t;
  }

  /**
   * A not mundane tile which should describes the shown data.
   */
  @Prop() tableTitle!: string;


  /**
   *  List of scenarios. Valid scenarios are
   *  <br /><br />
   *  variances pattern d<scenario_baseScenario>
   *  relative variance pattern dr<scenario_baseScenario>
   * <br /><br />
   *  values: <br />
   *  ```ac[1-4] | fc[1-4] | pp[1-4] | pl[1-4] | dfc[1-4]_ac[1-4] | drfc[1-4]_ac[1-4]```
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
   *  Defines the data unit type of the tables data.
   *  <br /><br />
   *  If percent is chosen all data values are converted into percent
   *  (0.02 ->  2%)
   *  <br /><br />
   *  values: <br />
   *  ```percent  // decimal```
   */
  @Prop() dataFormat: string = 'decimal';

  @Watch('dataFormat')
  validateDataFormat(newValue: string) {
    if (!isValidDataFormat(newValue)) {
      throw new Error('dataFormat: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   *  Toggles of data should be grouped by
   *  'rowgroup'.
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   */
  @Prop() grouped:  string = 'false';

  @Watch('grouped')
  validateGrouped(newValue: string) {
    if (!isValidBoolean(newValue)) {
      throw new Error('grouped: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   *  Toggles a title header for each (row-)group
   *  the title header value is found set by 'rowgroup'
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   *
   */
  @Prop() showGroupTitle: string = 'true';

  @Watch('showGroupTitle')
  validateShowGroupTitle(newValue: string ) {
    if (!isValidBoolean(newValue)) {
      throw new Error('showGroupTitle: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   *  Set the table type
   *  <br /><br />
   *  values: <br />
   *  ```list // sum // opt // sumnototal // optnototal```
   *
   */
  @Prop() type: string = 'list';

  @Watch('type')
  validateType(newValue: string | boolean) {
    if (!isValidTableType(newValue)) {
      throw new Error('type: invalid value(s) \'' + newValue?.toString() + '\' are not supported.');
    }
  }


  /**
   * Set the maximum number of rows for each
   * group. The value 0 means *no limit*
   * <br /><br />
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
   * Stringified Array of drilldown Objects {
            "rowGroup": string,<br />
            "category": string,<br />
            "subCategory": string,<br />
          },<br /><br />
   * rowgroup, categroy defines the location of the drill
   * subcategory is the displayed label of the data row
   *<br /><br />
   * example:<br />
   * ```[{
   "rowGroup":"Umsatz",
   "category": "Applications",
   "subCategory": "Applications-A",
   },]```
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
   * Stringified Array of Partof Objects <br />{<br />
            "rowGroup": string,<br />
            "category": string<br />
          },<br /><br />
   * rowgroup, categroy defines the location of the drill
   * percentage of category in rowgorup
   *<br /><br />
   * example:<br />
   * ```[{
   "rowGroups":"Umsatz",
   "category": "Applications",
   },]```
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
   *  <br /><br />
   *  values: <br />
   *  ```category // categoryindex // rowgroup // rowgroup // rowgroupindex // ac[1-4] // fc[1-4] // pp[1-4] // pl[1-4]```
   */
  @Prop() order: string = 'category';

  @Watch('order')
  validateOrderList(newValue: string) {
    const invalidElements: string[] = validateOrderList(newValue);
    if (invalidElements.length > 0) {
      throw new Error('order: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.');
    }
  }


  /** Set sorting order direction
   *  <br /><br />
   *  values: <br />
   * ```asc  // desc```
   */
  @Prop() orderDirection: string = 'asc';

  @Watch('orderDirection')
  validateOrderDirection(newValue: string) {
    if (!isValidDirection(newValue)) {
      throw new Error('orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }

  }

  /** Sets the Measure Type of the Table
   *  volume is different displayed and interpreted as currency
   *  names of siprefix are adapted.
   *  <br /><br />
   *  values: <br />
   *  ```volume // currency```

   */
  @Prop() measureType: string = "volume";

  @Watch('measureType')
  validateMeasureType(newValue: string) {
    if (!isValidMeasureType(newValue)) {
      throw new Error('order: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }
  }

  /**
   *  Sets the SiPrefix of the Mesaurements and converts the
   *  original value.
   *  <br /><br />
   *  values:  <br />
   *  ```_ // k // M // G // T // P // E // Z // Y // m // μ // n // p // P // f // a // z // y // GREATEST // LEAST```
   *  <br /><br />
   *  SiPrefix overview:
   *  ```     "Y":  1E+24,```<br />
   *  ```    "Z":  1E+21,```<br />
   *  ```   "E":  1E+18,```<br />
   *  ```     "P":  1E+15,```<br />
   *  ```     "T":  1E+12,```<br />
   *  ```     "G":  1000000000,```<br />
   *  ```     "M":  1000000,```<br />
   *  ```     "k":  1000,```<br />
   *  <br />
   *  ```     "m":  0.001,```<br />
   *  ```    "μ":  0.000001,```<br />
   *  ```     "n":  0.000000001,```<br />
   *  ```     "p":  0.000000000001,```<br />
   *  ```     "f":  0.000000000000001,```<br />
   *  ```     "a":  0.000000000000000001,```<br />
   *  ```     "z":  0.000000000000000000001,```<br />
   *  ```     "y":  0.000000000000000000000001,```<br />
   *  <br /><br />
   * Special modes:
   * ```GREATEST``` seaches for the bigest (farest to zero) Value in the dataset and sets this value to SiPrefix<br />
   * ```LEAST```    searches for smallest (closest to zero) Value in the dataset and sets this value to SiPrefix<br />
   *<br /><br />
   * ```_```        is the value for no SiPrefix the value is displayed as in the dataset stored.
   *
   *
   */
  @Prop() measureScale: string = "greatest";

  @Watch('measureType')
  validateMeasureScale(newValue: string) {
    if (!isValidMeasureScale(newValue)) {
      throw new Error('order: invalid value \'' + newValue?.toString() + '\' is not supported.');
    }
  }

  /**
   * Number of decimal digits in a table cell
   */
  @Prop() dataFormatDigitsDecimal: number = 1;

  @Watch('dataFormatDigitsDecimal')
  validateDataFormatDigitsDecimal(newValue: number) {
    if (!isValidInteger(newValue)) {
      throw new Error('dataFormatDigitsDecimal: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * Number of percent digits in a table cell
   */
  @Prop() dataFormatDigitsPercent: number = 2;

  @Watch('dataFormatDigitsPercent')
  validateDateFormatDigitsPercent(newValue: number) {
    if (!isValidInteger(newValue)) {
      throw new Error('dataFormatDigitsPercent: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   *  Set width of category column. <br />
   *  If INF is selected the columns scaling to the min space they need
   *  seperatly.
   *  <br /><br />
   *  values:<br />
   *  ``` w5 // w10 // w15 // w20 // w25 // w50 // inf ```
   */
  @Prop() categoryWidth: string = 'w15';

  @Watch('categoryWidth')
  validateCategoryWidth(newValue: string) {
    if (!isTableCategoryWidth(newValue)) {
      throw new Error('categoryWidth: invalid value(s) \'' + newValue + '\' are not supported.')
    }
  }

  /**
   * Defines which drill-column is displayed. <br />
   * <br /><br />
   * ```name``` is the name of the parent column of the drill <br/>
   * ```subGroups``` is a list of child columns of the parent <br/><br/>
   * example:<br />
   * ```{"ac1": [{"name": "DE", "subGroups": ["Berlin"]},
   *             {"name": "UK", "subGroups": []}],
   *    }```
   */
  @Prop() categorythereof: string | null = null;

  @Watch('categorythereof')
  validateCategoryThereOf(newValue: string | null) {
      const invalidElements: string[] = validateCategoryThereOfJsonStr(newValue);
    if (invalidElements.length > 0) {
      throw new Error('categorythereof: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.');
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
    this.validateDataFormatDigitsDecimal(this.dataFormatDigitsDecimal);
    this.validateDateFormatDigitsPercent(this.dataFormatDigitsPercent);
    this.validateCategoryWidth(this.categoryWidth);
    this.validateMeasureType(this.measureType);
    this.validateMeasureScale(this.measureScale);
    this.validateCategoryThereOf(this.categorythereof)
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private prepareDataFormat(): DataFormat {
    return DataFormat[this.dataFormat?.toUpperCase() as keyof typeof DataFormat];
  }

  private prepareGrouped(): boolean {
    return (this.grouped == "true");
  }

  private prepareShowGroupTitle(): boolean {
    return ( this.showGroupTitle == "true");
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
    return I18nMode.META;
  }

  private prepareI18n(): Map<string, string> {
    const i18nMetaLabelsLocal = ["in", "category","operation", "there_of", "part_of","SUM_TOTAL" ];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    let i18nMapLocal  = new Map(i18nMetaLabelsLocal.map(key  => [key, this.t(".".concat(key))]));
    let i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map(key => [key, this.t("global.".concat(key))]));

    return  new Map([...i18nMapGlobal.entries(),...i18nMapLocal.entries()]);
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

  private prepareCategoryThereOf(): Map<string, any> {
    if (this.categorythereof == null || this.categorythereof.trim() == '') {
      return new Map();
    }
    let parsedString =  JSON.parse(this.categorythereof);
    let map = new Map();

    for (const [key, value] of Object.entries(parsedString)) {
      map.set(key, value as any);

    }

    return map;
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
        categorythereof = {this.prepareCategoryThereOf()}
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
