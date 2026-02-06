import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import {
  isBlankInput,
  isTableCategoryWidth,
  isValidBoolean,
  isValidDataFormat,
  isValidDirection,
  isValidInteger,
  isValidMeasureScale,
  isValidMeasureType,
  isValidNumber,
  isValidTableType,
  validateColumnThereOfJsonStr,
  validateOrderList,
  validatePartOfJsonStr,
  validateScenarioList,
  validateThereOfJsonStr, validateVariancesList
} from "../../utils/validate";

import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import { globalLabelKeys } from "../../stores/internationalization";
import withTranslation from "../../utils/withTranslation";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import { Style } from "../../stores/componentStyles";


/*import {
  DataFormat,
  I18nMode,
  IDataFormatDigits,
  IOrder,
  ITableDataRow,
  MeasureType,
  OrderColumn,
  OrderDirection,
  TableCategoryWidth,
  TableDrillGroup,
  TableType,
} from "@bino-bi/ibcs-component-interface";*/
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { TableDataRow } from "./utils/model/TableDataRow";
import { DataFormat, I18nMode, MeasureType, TableCategoryWidth } from "../../utils/constants";
import { TableType } from "./utils/model";
import { TableDrillGroup } from "./utils/model/TableDrillGroup";
import { Order, OrderColumn, OrderDirection } from "../../utils/model/Order";
import { DataFormatDigits } from "../../utils/model/DataFormatDigits";

@Component({
  tag: 'bn-table',
  styleUrl: 'bn-table.css',
  shadow: true
})
export class Table {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  private readonly t: (key: string, data?: object) => string;
  private readonly errors: ErrorDispatcher;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  @State() data: TableDataRow[] = []


  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);

    withDataset(this, (_name, data) => {
      this.data = data || [];
    });

    this.t = withTranslation(this).t;
  }

  /**
   * A not mundane tile which should describes the shown data.
   */
  @Prop() tableTitle: string = "";


  @Prop()
  filter: string = "";


  /**
    * measureUnit displayed in table.
    */
  @Prop() measureUnit: string = "";


  /** List of scenarios displayed in card header.
   *  <br /><br />
   *  If scenarios is empty string (`''` or `null`) the scenarios are omitted
   *  <br /><br />
   *  values:<br /> ```ac // fc // py // pl // null```
   */
  @Prop() readonly scenarios: string;

  @Watch('scenarios')
  validateScenario(newValue: string) {
    const errId: string = 'ERR_scenarios';

    const invalidScenarios: string[] = validateScenarioList(newValue);

    if (invalidScenarios.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'scenarios: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }


  /** <br /> <br />
   List of Variances
   The additonal variances which
   are calculated form the given scenarios.
   the scenarios used in the variances have also
   be defined in the *scenarios* property.
   <br /> <br />
   the variance is defiend as  (Scenario A -  ScenarioB)
   neu. neg and pos post fix defines which value is *good*
   a negative or a positive value.
   <br /> <br />
   if empty variance charts are hidden
   <br /> <br />
   each variance creates a chart
   <br /> <br />
   pattern:<br />  ```d<scenarioB>_<scenarioA>_[pos/neg/neu]```
   */
  @Prop() readonly variances: string;

  @Watch('variances')
  validateVariances(newValue: string) {
    const errId: string = 'ERR_variances';
    const invalidVariances: string[] = validateVariancesList(newValue);

    if (invalidVariances.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'variances: invalid value(s) \'' + JSON.stringify(invalidVariances) + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * List of variance column names to render as bar charts instead of numbers.
   * <br /><br />
   * Absolute variances (d_*) render as horizontal bar charts.
   * Relative variances (dr_*) render as pin/dot charts.
   * <br /><br />
   * example:<br />
   * ```dac1_pp1_pos,drac1_pp1_pos```
   */
  @Prop() readonly barColumns: string;

  @Watch('barColumns')
  validateBarColumns(newValue: string) {
    const errId: string = 'ERR_barColumns';
    if (isBlankInput(newValue)) {
      this.errors.remove(errId);
      return;
    }
    const invalidColumns: string[] = validateVariancesList(newValue);
    if (invalidColumns.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'barColumns: invalid value(s) \'' + JSON.stringify(invalidColumns) + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Scaling for absolute variance bar charts (ΔPY).
   * <br /><br />
   * Name of the 'scaling-group' which the table uses.
   * Scaling groups are maintained globally.
   * <br /><br />
   * Alternatively a number which represents pixels per unit of measure.
   * <br /><br />
   * Example: 0.01 means 1000 units = 10 pixels width.
   * <br /><br />
   * Default: 0.01
   */
  @Prop() unitScaling: string | number = 0.01;

  @Watch('unitScaling')
  validateUnitScaling(newValue: string | number) {
    const errId: string = 'ERR_unitScaling';

    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'unitScaling: invalid value \'' + newValue + '\' is not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Scaling for relative variance pin charts (ΔPY%).
   * <br /><br />
   * Name of the 'scaling-group' which the table uses.
   * Scaling groups are maintained globally.
   * <br /><br />
   * Alternatively a number which represents pixels per percentage point.
   * <br /><br />
   * Example: 0.5 means 100% = 50 pixels width.
   * <br /><br />
   * Default: 0.5
   */
  @Prop() percentageScaling: string | number = 0.5;

  @Watch('percentageScaling')
  validatePercentageScaling(newValue: string | number) {
    const errId: string = 'ERR_percentageScaling';

    if (!isValidNumber(newValue as number) && !this.pixelPerUnitGroupMap.has(newValue as string)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'percentageScaling: invalid value \'' + newValue + '\' is not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  // Global scaling groups map - can be populated externally for shared scaling across components
  private pixelPerUnitGroupMap: Map<string, number> = new Map<string, number>();

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
    const errId: string = 'ERR_dataFormat';

    if (!isValidDataFormat(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'dataFormat: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }


  /**
   *  Toggles of data should be grouped by
   *  'rowgroup'.
   *  <br /><br />
   *  values: <br />
   *  ```true // false```
   */
  @Prop() grouped: string = 'false';

  @Watch('grouped')
  validateGrouped(newValue: string) {
    const errId: string = 'ERR_grouped';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'grouped: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
 *  Toggles display of measure units in table header
 *  <br /><br />
 *  values: <br />
 *  ```true // false```
 */
  @Prop() showMeasureScale: string = 'false';

  @Watch('showMeasureScale')
  validateShowMeasureScale(newValue: string) {
    const errId: string = 'ERR_grouped';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'showMeasureScale: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
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
  validateShowGroupTitle(newValue: string) {
    const errId: string = 'ERR_showGroupTitle';

    if (!isValidBoolean(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'showGroupTitle: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_type';

    if (!isValidTableType(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'type: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_limit';

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'order: invalid value \'' + newValue?.toString() + '\' is not supported.' });
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_thereof';
    const invalidElements: string[] = validateThereOfJsonStr(newValue);

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'ThereOf: invalid value(s) \'' + JSON.stringify(invalidElements) + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_partof';
    const invalidElements: string[] = validatePartOfJsonStr(newValue);

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'partof: invalid value(s) \'' + JSON.stringify(invalidElements) + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_order';
    const invalidElements: string[] = validateOrderList(newValue);

    if (invalidElements.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'order: invalid value(s) \'' + JSON.stringify(invalidElements) + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_orderDirection';

    if (!isValidDirection(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'orderDirection: invalid value \'' + newValue?.toString() + '\' is not supported.' });
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_measureType';

    if (!isValidMeasureType(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'measureType: invalid value \'' + newValue?.toString() + '\' is not supported.' });
    } else {
      this.errors.remove(errId);
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

  @Watch('measureScale')
  validateMeasureScale(newValue: string) {
    const errId: string = 'ERR_measureScale';

    if (!isValidMeasureScale(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'measureScale: invalid value \'' + newValue?.toString() + '\' is not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Number of decimal digits in a table cell
   */
  @Prop() dataFormatDigitsDecimal: number = 1;

  @Watch('dataFormatDigitsDecimal')
  validateDataFormatDigitsDecimal(newValue: number) {
    const errId: string = 'ERR_dataFormatDigitsDecimal';

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'dataFormatDigitsDecimal: invalid value(s) \'' + newValue + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Number of percent digits in a table cell
   */
  @Prop() dataFormatDigitsPercent: number = 2;

  @Watch('dataFormatDigitsPercent')
  validateDateFormatDigitsPercent(newValue: number) {
    const errId: string = 'ERR_dataFormatDigitsPercent';

    if (!isValidInteger(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'dataFormatDigitsPercent: invalid value(s) \'' + newValue + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_categoryWidth';

    if (!isTableCategoryWidth(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'categoryWidth: invalid value(s) \'' + newValue + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }

  /**
   * Defines which drill-column is displayed. <br />
   * <br /><br />
   * ```scenario``` the scenaro to drill <br/>
   * ```group``` is a list of child columns of the parent <br/><br/>
   * ```subGroups``` is a list of child columns of the parent <br/><br/>
   * example:<br />
   * ```[{"scenario": "ac1", "name": "DE", "subGroups": ["Berlin"]},
   *     {"scenario": "ac2", "name": "UK", "subGroups": []}],
   *    ```
   */
  @Prop() columnthereof: string | null = null;

  @Watch('columnthereof')
  validateColumnThereOf(newValue: string | null) {
    const invalidElements: string[] = validateColumnThereOfJsonStr(newValue);
    const errId: string = 'ERR_categorythereof';
    if (invalidElements.length > 0) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'columnthereof: invalid value(s) \'' + JSON.stringify(invalidElements) + '\' are not supported.' });
    } else {
      this.errors.remove(errId);
    }
  }


  unsubscribe: () => void

  componentWillLoad() {
    //this.datasouce = get("test");
    // this.unsubscribe = onChange("test", (value) => this.datasouce = value);

    this.validateScenario(this.scenarios);
    this.validateVariances(this.variances);
    this.validateDataFormat(this.dataFormat);
    this.validateGrouped(this.grouped);
    this.validateShowGroupTitle(this.showGroupTitle);
    this.validateType(this.type);
    this.validateLimit(this.limit);
    this.validateThereOf(this.thereof);
    this.validatePartOf(this.partof);
    this.validateOrderDirection(this.orderDirection);
    this.validateOrderList(this.order);
    this.validateDataFormatDigitsDecimal(this.dataFormatDigitsDecimal);
    this.validateDateFormatDigitsPercent(this.dataFormatDigitsPercent);
    this.validateCategoryWidth(this.categoryWidth);
    this.validateMeasureType(this.measureType);
    this.validateMeasureScale(this.measureScale);
    this.validateColumnThereOf(this.columnthereof);
    this.validateShowMeasureScale(this.showMeasureScale);
    this.validateBarColumns(this.barColumns);
    this.validateUnitScaling(this.unitScaling);
    this.validatePercentageScaling(this.percentageScaling);
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

    return (this.showGroupTitle == "true");
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

  private preparePartOf(): TableDrillGroup[] {
    if (this.partof == null || this.partof.trim() == '') {
      return [];
    }
    return JSON.parse(this.partof!) as TableDrillGroup[];

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
    const i18nMetaLabelsLocal = ["in", "category", "operation", "there_of", "part_of", "SUM_TOTAL"];
    const i18nMetaLabelsGlobal = globalLabelKeys;

    // system
    let i18nMapLocal = new Map(i18nMetaLabelsLocal.map(key => [key, this.t(".".concat(key))]));
    let i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map(key => [key, this.t("global.".concat(key))]));

    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }


  private prepareDataFormatDigits(): DataFormatDigits {
    const formatDigits: DataFormatDigits = {
      percent: this.dataFormatDigitsPercent,
      decimal: this.dataFormatDigitsDecimal
    };

    return formatDigits;
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios) && isBlankInput(this.variances)) {
      return [];
    }
    let scenarios = [];

    if (this.scenarios?.trim().length > 0) {
      scenarios = scenarios.concat(this.scenarios?.split(","));
    }

    if (this.variances?.trim().length > 0) {
      scenarios = scenarios.concat(this.variances?.split(","));
    }
    return scenarios.map(entry => entry.trim());
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

  private prepareMeasureType(): MeasureType {
    if (isBlankInput(this.measureType)) {
      return MeasureType.VOLUME;
    }
    return MeasureType[this.measureType?.toUpperCase() as keyof typeof MeasureType];
  }

  private prepareColumnThereOf(): Map<string, any> {
    if (this.columnthereof == null || this.columnthereof.trim() == '') {
      return new Map();
    }
    let parsedString = JSON.parse(this.columnthereof);
    let map = new Map();

    for (const [_key, value] of Object.entries(parsedString)) {
      if (map.has(value["scenario"]) == false) {
        map.set(value["scenario"], []);
      }
      map.get(value["scenario"]).push(value);
    }

    return map;
  }

  private prepareTableTitle(): string {
    if (this.tableTitle == "" || this.tableTitle == null) {
      return "SUM_TOTAL";
    }
    return this.tableTitle;
  }

  prepareShowMeasureScale(): boolean {
    return (this.showMeasureScale == "true");
  }
  prepareMeasureUnit(): string {
    if (this.measureUnit == "" || this.measureUnit == null) {
      return "";
    }
    return this.measureUnit;
  }

  private prepareFilter(): string {
    if (this.filter.length == 0) {
      return '';
    }

    return this.filter;
  }

  private prepareBarColumns(): string[] {
    if (isBlankInput(this.barColumns)) {
      return [];
    }
    return this.barColumns.split(',').map(col => col.trim());
  }

  private prepareUnitScaling(): number {
    if (this.pixelPerUnitGroupMap.has(this.unitScaling as string)) {
      return this.pixelPerUnitGroupMap.get(this.unitScaling as string)!;
    }
    return Number(this.unitScaling);
  }

  private preparePercentageScaling(): number {
    if (this.pixelPerUnitGroupMap.has(this.percentageScaling as string)) {
      return this.pixelPerUnitGroupMap.get(this.percentageScaling as string)!;
    }
    return Number(this.percentageScaling);
  }

  public getDataStructure(): any {
    let dataSetStructure: any = {
      ITableDataRow: {
        setName: { type: "string", isOptional: false, description: "" },
        date: { type: "string", isOptional: false, description: "" },
        operation: { type: "string", isOptional: false, description: "" },
        rowGroup: { type: "string", isOptional: false, description: "" },
        rowGroupIndex: { type: "number", isOptional: false, description: "" },
        category: { type: "string", isOptional: false, description: "" },
        categoryIndex: { type: "number", isOptional: false, description: "" },
        subCategory: { type: "string", isOptional: false, description: "" },
        subCategoryIndex: { type: "number", isOptional: false, description: "" },
        columnGroup: { type: "string", isOptional: false, description: "" },
        columnGroupIndex: { type: "number", isOptional: false, description: "" },
        columnSubGroup: { type: "string", isOptional: false, description: "" },
        columnSubGroupIndex: { type: "number", isOptional: false, description: "" },
        ac1: { type: "number", isOptional: false, description: "" },
        ac2: { type: "number", isOptional: false, description: "" },
        ac3: { type: "number", isOptional: false, description: "" },
        ac4: { type: "number", isOptional: false, description: "" },
        pp1: { type: "number", isOptional: false, description: "" },
        pp2: { type: "number", isOptional: false, description: "" },
        pp3: { type: "number", isOptional: false, description: "" },
        pp4: { type: "number", isOptional: false, description: "" },
        fc1: { type: "number", isOptional: false, description: "" },
        fc2: { type: "number", isOptional: false, description: "" },
        fc3: { type: "number", isOptional: false, description: "" },
        fc4: { type: "number", isOptional: false, description: "" },
        pl1: { type: "number", isOptional: false, description: "" },
        pl2: { type: "number", isOptional: false, description: "" },
        pl3: { type: "number", isOptional: false, description: "" },
        pl4: { type: "number", isOptional: false, description: "" }
      }
    };

    return dataSetStructure;
  }


  private getFontStyles(): { [key: string]: string } {
    return this.componentStyle($ => ({
      '--bn-font-family': $["global"]?.["fontFamily"] || "'Noto Sans', sans-serif",
      '--bn-font-size': `${$["global"]?.["fontSizePx"] || 13.3333}px`,
      '--bn-font-color': $["global"]?.["fontColor"] || '#000000',
      '--bn-font-background': $["global"]?.["fontBackgroundColor"] || '#ffffff',
    }));
  }

  render() {
    const fontStyles = this.getFontStyles();

    return <Host style={fontStyles}>
      <div>
        <ibcs-table
          data={this.data}
          table-title={this.prepareTableTitle()}
          scenarios={this.prepareScenarios()}
          scenarios-data-format={this.prepareDataFormat()}
          grouped={this.prepareGrouped()}
          limit={this.prepareLimit()}
          showGroupTitle={this.prepareShowGroupTitle()}
          thereof={this.prepareThereOf()}
          partof={this.preparePartOf()}
          order={this.prepareOrder()}
          categorythereof={this.prepareColumnThereOf()}
          type={this.prepareTableType()}
          category-width={this.prepareCategoryWidth()}
          dataFormatDigits={this.prepareDataFormatDigits()}
          i18n={this.prepareI18n()}
          i18n-mode={this.prepareI18nMode()}
          measure-scale={this.prepareMeasureScale()}
          measure-type={this.prepareMeasureType()}
          measure-unit={this.prepareMeasureUnit()}
          showMeasureScale={this.prepareShowMeasureScale()}
          filter={this.prepareFilter()}
          barColumns={this.prepareBarColumns()}
          unitScaling={this.prepareUnitScaling()}
          percentageScaling={this.preparePercentageScaling()}
        ></ibcs-table>
      </div>
    </Host>;
  }

}
