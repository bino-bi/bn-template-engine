import {Component, h, Host, Prop, State, Watch} from "@stencil/core";
import {
  isBlankInput,
  isTableCategoryWidth,
  isValidBoolean,
  isValidDataFormat,
  isValidDirection,
  isValidInteger,
  isValidMeasureScale,
  isValidMeasureType,
  isValidTableType,
  validateCategoryThereOfJsonStr,
  validateOrderList,
  validatePartOfJsonStr,
  validateScenarioList,
  validateThereOfJsonStr, validateVariancesList
} from "../../utils/validate";

import withDataset from "../../utils/withDataset";
import withComponentStatus from "../../utils/withComponentStatus";
import {globalLabelKeys} from "../../stores/internationalization";
import withTranslation from "../../utils/withTranslation";
import {withStyled} from "../../utils/styled/withStyled";


import {
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
} from "@bino-bi/ibcs-component-interface";
import withHasError, {ErrorDispatcher} from "../../utils/withHasError";

@Component({
  tag: 'bn-table',
  styleUrl: 'bn-table.css'
})
export class Table {
  private readonly t: (key: string, data?: object) => string;
  private readonly errors: ErrorDispatcher;
  @State() data: ITableDataRow[] = []


  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    withDataset(this, (_name, data) => {
      this.data = data || [];
    });

    this.t = withTranslation(this).t;
  }

  /**
   * A not mundane tile which should describes the shown data.
   */
  @Prop() tableTitle: string = "";


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
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'scenarios: invalid value(s) \'' + invalidScenarios?.toString() + '\' are not supported.'});
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
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'variances: invalid value(s) \'' + invalidVariances?.toString() + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_dataFormat';

    if (!isValidDataFormat(newValue)) {
      this.errors.addOrReplace({id: errId, type: 'warning', message:'dataFormat: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
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
      this.errors.addOrReplace({id: errId, type: 'warning', message: 'grouped: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
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
      this.errors.addOrReplace({id: errId,  type: 'warning', message: 'showGroupTitle: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
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
      this.errors.addOrReplace({id: errId, type: 'warning', message: 'type: invalid value(s) \'' + newValue?.toString() + '\' are not supported.' });
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
      this.errors.addOrReplace({id: errId, type: 'warning', message: 'order: invalid value \'' + newValue?.toString() + '\' is not supported.' });
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
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'ThereOf: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.' });
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
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'partof: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.' });
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
      this.errors.addOrReplace({  id: errId, type: 'warning', message: 'order: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.' });
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
      this.errors.addOrReplace({id: errId, type: 'warning', message: 'measureType: invalid value \'' + newValue?.toString() + '\' is not supported.' });
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

  @Watch('measureType')
  validateMeasureScale(newValue: string) {
    const errId: string = 'ERR_measureType';

    if (!isValidMeasureScale(newValue)) {
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'measureType: invalid value \'' + newValue?.toString() + '\' is not supported.' });
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
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'dataFormatDigitsDecimal: invalid value(s) \'' + newValue + '\' are not supported.'});
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
      this.errors.addOrReplace({ id: errId, type: 'warning', message: 'dataFormatDigitsPercent: invalid value(s) \'' + newValue + '\' are not supported.'});
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
      this.errors.addOrReplace({ id: errId,type: 'warning', message: 'categoryWidth: invalid value(s) \'' + newValue + '\' are not supported.'});
    } else {
      this.errors.remove(errId);
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
    const errId: string = 'ERR_categorythereof';
    if (invalidElements.length > 0) {
      this.errors.addOrReplace({  id: errId, type: 'warning', message:'categorythereof: invalid value(s) \'' + invalidElements?.toString() + '\' are not supported.'});
    } else {
      this.errors.remove( errId);
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


  private prepareOrder(): IOrder {
    const tableOrder: IOrder = {
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

    let i18nMapLocal = new Map(i18nMetaLabelsLocal.map(key => [key, this.t(".".concat(key))]));
    let i18nMapGlobal = new Map(i18nMetaLabelsGlobal.map(key => [key, this.t("global.".concat(key))]));

    return new Map([...i18nMapGlobal.entries(), ...i18nMapLocal.entries()]);
  }


  private prepareDataFormatDigits(): IDataFormatDigits {
    const formatDigits: IDataFormatDigits = {
      percent: this.dataFormatDigitsPercent,
      decimal: this.dataFormatDigitsDecimal
    };

    return formatDigits;
  }

  private prepareScenarios(): string[] {
    if (isBlankInput(this.scenarios) && isBlankInput(this.variances)  ) {
      return [];
    }
    let scenarios = [];

    if(this.scenarios?.trim().length > 0) {
      scenarios = scenarios.concat(this.scenarios?.split(","));
    }

    if(this.variances?.trim().length > 0) {
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

  private prepareCategoryThereOf(): Map<string, any> {
    if (this.categorythereof == null || this.categorythereof.trim() == '') {
      return new Map();
    }
    let parsedString = JSON.parse(this.categorythereof);
    let map = new Map();

    for (const [key, value] of Object.entries(parsedString)) {
      map.set(key, value as any);

    }



    return map;
  }

  private prepareTableTitle(): string {

    return this.tableTitle;
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


  render() {
    return <Host>
      <div>
        <ibcs-table
          data={this.data}
          table-title={this.prepareTableTitle()}
          scenarios={this.prepareScenarios()}
          scenarios-data-format={this.prepareDataFormat()}
          grouped={this.prepareGrouped()}
          limit={this.prepareLimit()}
          show-group-title={this.prepareShowGroupTitle()}
          thereof={this.prepareThereOf()}
          partof={this.preparePartOf()}
          order={this.prepareOrder()}
          categorythereof={this.prepareCategoryThereOf()}
          type={this.prepareTableType()}
          category-width={this.prepareCategoryWidth()}
          dataFormatDigits={this.prepareDataFormatDigits()}
          i18n={this.prepareI18n()}
          i18n-mode={this.prepareI18nMode()}
          measure-scale={this.prepareMeasureScale()}
          measure-type={this.prepareMeasureType()}
        ></ibcs-table>
      </div>
    </Host>;
  }
}
