import {TableRow} from "../elements";
import {TableRowType, TableType} from "../model";
import {DataQuery} from "../helper"

import {TableDataRow} from "../model/TableDataRow";
import {TableComponentConfig} from "../model/TableComponentConfig";
import { Formatter } from "../../../../utils";
import { I18nMode, DataFormat, TableCategoryWidth } from "../../../../utils/constants";
import { QueryColumnNames, VarianceScenario } from "../../../../utils/model";
import { SiPrefix } from "../../../../utils/model/SiPrefix";
import { ColumnStats } from "../elements/Cell";

export class TableDataSetFactory {

  private normalizedHeader: {name: string, group: string, type: string, order: string | undefined}[] = [];

  constructor() {

  }

  /**
   * Creates Tableheader based on the configured scenarios (in config)
   * the created header is stored in the dataset json
   * the lables are translated based on the used i18n map
   * based on the structure of the scenarios 'spacer'coulumns are added, to
   * visualise grouping.
   * finally a seperator header row is created for the header underlining (border)
   */
  public createHeader(type: TableType, scenarios: readonly {name: string, group: string, type:string, order: string | undefined }[], i18n: Map<string | number, string>,measureScale: SiPrefix, measureUnit: String, showMeasureScale: boolean): TableRow[] {
    let header: TableRow[] = [];

    this.normalizedHeader = this.normalizeHeader(type, scenarios);
    let headerRow: TableRow = new TableRow( 0, 0,  TableRowType.HEADER);
    let separatorRow: TableRow = new TableRow(1, 0,TableRowType.SEPERATORLINE);

    for (let scenario of this.normalizedHeader) {     
      headerRow.createElement(Formatter.translateScenarioLabel(scenario.name, i18n), 
                              scenario.type, 
                              this.createColumnType(scenario), 
                              null, 
                              this.setHeaderPrefix(scenario, i18n, measureScale, measureUnit, showMeasureScale),
                              null,null,null,null);
      separatorRow.createElement(null, scenario.type,  this.createColumnType(scenario),null,null,null,null,null,null);
    }

    header.push(headerRow);
    header.push(separatorRow);

    return header;
  }

  private setHeaderPrefix(scenario: { name: string; group: string; type: string; order: string | undefined; }, i18n: Map<string | number, string>,measureScale: SiPrefix , measureUnit: String , showMeasureScale: boolean) {
    let prefix = "";

    if(scenario.name == 'category' && showMeasureScale  ) {    
      if( measureScale.prefix.length !== 0 || measureUnit.length !== 0 ){
        prefix = Formatter.translateScenarioLabel("in" , i18n) + " " + measureScale.prefix + measureUnit;
      }     
    }

    if (scenario.order) {      
      prefix += Formatter.translateScenarioLabel("ORDER_" + scenario.order, i18n);
    }

    return prefix;
  }

  /**
   * combines the default columnnames (operation and category) with the
   * configured scenarios.
   * depending of table type operation column is used (OPT) or not (SUM | LIST)
   * in addition the headers are sorted based on the ruleset and duplicates are removed
   */
  private normalizeHeader(type: TableType, scenarios: readonly {name: string, group: string, type: string, order: string | undefined }[]): {name: string, group: string, type:string, order: string | undefined }[] {

    let header: {name: string, group: string,  type:string , order: string | undefined}[] = [{  name: QueryColumnNames.CATEGORY,
                                                                                                group: QueryColumnNames.CATEGORY,
                                                                                                type: QueryColumnNames.CATEGORY,
                                                                                                order: undefined}];

    if (TableType.OPT === type || TableType.OPTNOTOTAL === type) {
      header = [{name: QueryColumnNames.OPERATION, group: QueryColumnNames.OPERATION,type: QueryColumnNames.OPERATION, order: undefined }, {name: QueryColumnNames.CATEGORY, group: QueryColumnNames.CATEGORY,type: QueryColumnNames.CATEGORY, order: undefined }];
    }
    
    // NOTE: scenarios are already sorted in setConfig
    return [...header, ...scenarios];
  }

  /**
   * Creates table data colelction,
   * eachh row consists of data columns and 'spacer' columns which are needed to seperate
   * the columns correctyl (IBCS style)
   */
  public createBodyRows(config: TableComponentConfig, i18n: Map<string | number, string>, data: TableDataRow[]): TableRow[] {

    let bodyRows: TableRow[] = [];

    let iGroupIndex: number = -1; // index used in detailRow JSON to count the current group
    let queryData = new DataQuery(config, i18n).execute(data); // collection of all query results

    // Calculate column statistics for bar columns
    const columnStatsMap = this.calculateColumnStatistics(queryData, config.barColumns);

    for (let groupData of queryData) {
      // groupData is a collection of dataRows, each group base on a query and represents a 'row' group
      iGroupIndex += 1;
      let iRowIndex: number = -1;
      bodyRows.push(...this.createRow(config.i18n, i18n, config.scenariosUnitType, groupData, iGroupIndex, iRowIndex, config.categoryWidth, config.measureScale, config.barColumns, columnStatsMap));
    }

    return bodyRows;
  }

  /**
   * Calculate min/max statistics for bar chart columns across all query data.
   */
  private calculateColumnStatistics(queryData: any[][], barColumns: string[]): Map<string, ColumnStats> {
    const statsMap = new Map<string, ColumnStats>();

    if (!barColumns || barColumns.length === 0) {
      return statsMap;
    }

    // Initialize stats for each bar column
    for (const column of barColumns) {
      statsMap.set(column, { min: Infinity, max: -Infinity, absMax: 0 });
    }

    // Iterate through all groups and rows
    for (const groupData of queryData) {
      for (const row of groupData) {
        for (const column of barColumns) {
          const value = this.extractColumnValue(row, column);
          if (value !== null && !isNaN(value)) {
            const stats = statsMap.get(column)!;
            stats.min = Math.min(stats.min, value);
            stats.max = Math.max(stats.max, value);
          }
        }
      }
    }

    // Finalize absMax values
    for (const [column, stats] of statsMap) {
      if (stats.min === Infinity || stats.max === -Infinity) {
        stats.min = 0;
        stats.max = 0;
      }
      stats.absMax = Math.max(Math.abs(stats.min), Math.abs(stats.max));
      statsMap.set(column, stats);
    }

    return statsMap;
  }

  /**
   * Extract a numeric value from a row for a given column name.
   * Handles the various naming conventions used in the table data.
   */
  private extractColumnValue(row: any, column: string): number | null {
    // Try direct access
    if (row[column] !== undefined) {
      const val = Number(row[column]);
      return isNaN(val) ? null : val;
    }

    // Search for keys that match the column (handles scenario## prefix patterns)
    for (const key of Object.keys(row)) {
      if (key === column || key.endsWith('##' + column) || key === column + '##' + column) {
        const val = Number(row[key]);
        if (!isNaN(val)) {
          return val;
        }
      }
    }

    return null;
  }

  /**
   * Helper funciton to generate a new Table Row,
   * it calls itsself recursive if a drilldown is set by the config file.
   * a drilldown is detected if there is a colection of rows in .drill
   *
   * @param i18nMode
   * @param i18n
   * @param scenariosUnitType
   * @param groupData
   * @param iGroupIndex
   * @param iRowIndex
   * @param categoryWidth
   * @param measureScale
   * @param barColumns
   * @param columnStatsMap
   */
  private createRow(i18nMode: I18nMode | undefined, i18n: Map<string | number, string>, scenariosUnitType: DataFormat, groupData: any, iGroupIndex: number, iRowIndex: number, categoryWidth?: TableCategoryWidth, measureScale?: SiPrefix, barColumns?: string[], columnStatsMap?: Map<string, ColumnStats>): TableRow[] {
    let result: TableRow[] = [];

    for (let rawDataRow of groupData) {
      iRowIndex += 1;
      // create next table row
      let groupName = rawDataRow[QueryColumnNames.ROWGROUP];
      let subCategory = rawDataRow[QueryColumnNames.SUBCATEGORY];
      let type = rawDataRow[QueryColumnNames.TYPE];
      let isSecondElement = rawDataRow[QueryColumnNames.ROWNR] >= 2;

      let detailsRow: TableRow = this.createDetailRow(type, iRowIndex, iGroupIndex, groupData.length);
      for (let scenario of this.normalizedHeader) {

        let value = this.getRawDataRowElement(rawDataRow, scenario);
        const isBarChart = barColumns?.includes(scenario.type) ?? false;
        const columnStats = isBarChart ? columnStatsMap?.get(scenario.type) : undefined;

        detailsRow.createElement(this.translateSumCellLabel(i18nMode,i18n,value, groupName,subCategory, type, scenario.type),
                                 scenario.type,
                                 this.createColumnType(scenario),
                                 this.setCellType(scenario.type, scenariosUnitType),
                                 this.translateCellPrefix(i18n, type, scenario.type),
                                 this.translateScenarioCSS(scenario.type, value),
                                 isSecondElement,
                                 categoryWidth,
                                 measureScale?.value,
                                 isBarChart,
                                 columnStats);
      }

      result.push(detailsRow);
    }

    return result
  }

  private getRawDataRowElement(rawDataRow: any, scenario: { name: string; group: string; type: string }) {
    if (scenario.name == scenario.group && scenario.name == scenario.type ){
      // Default Sum Scenario (e.g. AC)
      return  rawDataRow[scenario.name];
    } else if(scenario.name == scenario.group && scenario.name != scenario.type){
      return  rawDataRow[scenario.type + "##" +scenario.name];
    }

    return  rawDataRow[scenario.type + "##" + scenario.group  + "##" + scenario.name ];
  }

  /**
   * Crates a detail row depending on the radDataRow Type
   * it switches between header, sum and standard,
   *
   * @param type      valid values GROUPHEADER, SUM   other values are interpreted as standard
   * @param rowIndex
   * @param groupIndex
   * @param maxIndex  total number of rows
   */
  private createDetailRow(type: string, rowIndex: number, groupIndex: number, maxIndex: number): TableRow {
     switch(type) {
      case TableRowType.GROUPHEAD:
        return new TableRow(rowIndex, groupIndex, TableRowType.HEADER);
      case TableRowType.SUM:
        return new TableRow(maxIndex + 2, groupIndex, TableRowType.SUM);
      case TableRowType.GROUPSUM:
        return new TableRow(maxIndex + 2, groupIndex, TableRowType.SUM);
      case TableRowType.DRILLELEMENT:
        return new TableRow(maxIndex + 2, groupIndex, TableRowType.DRILLELEMENT);
       case TableRowType.PARTELEMENT:
         return new TableRow(maxIndex + 2, groupIndex, TableRowType.PARTELEMENT);
      default :
        return new TableRow(rowIndex, groupIndex, TableRowType.STANDARD);
    }
  }




  /**
   * Translates Cell-Value (value) if possible,
   * Numbers are not translated, just category names,
   * if it is a SUM ROW  rowGroup is used
   * if it is a variance in OPT mode the absolute value is used
   *
   * @param value
   * @param rowGroup
   * @param type
   * @param scenario
   * @param subCategory
   */
  private translateSumCellLabel(i18nMode: I18nMode | undefined, i18n: Map<string | number, string>, value: string | number, rowGroup: string,subCategory:  string,  type: string, scenario: string): string | number {
    if (Number.isNaN(Number(value)) == false) {
        return value;
    }

    if (this.isOperationColumn(scenario)){
      return value;
    }

    if (this.isGroupHeadCategory(type, scenario)) {
      if(i18nMode == I18nMode.ALL ) {
        return `${i18n.get(value) || value}`;
      }

      return value;
    }

    if (this.isEntryCategory(type,  scenario)) {
      if(i18nMode == I18nMode.ALL) {
        return `${i18n.get(value) || value}`;
      }

      return value;
    }

    if (this.isDrillElementCategory(type,  scenario)) {
      if(i18nMode == I18nMode.ALL) {
        return `${i18n.get(subCategory) || subCategory}`;
      }

      return `${subCategory}`;
    }

    if (this.isPartElementCategory(type,  scenario)) {
        // translate allways because of default sum symbol.
      if(i18nMode == I18nMode.ALL || rowGroup === "SUM_TOTAL" ) {
        return  `${i18n.get(rowGroup) || rowGroup}`;
      }
      return `${rowGroup}`;

    }

    if (this.isSumElementCategory(type,  scenario)) {
      if(i18nMode == I18nMode.ALL || rowGroup === "SUM_TOTAL" ) {
        return  `${i18n.get(rowGroup) || rowGroup}`;
      }

      return rowGroup;
    }

    if ("GROUPHEAD" == type && value == null) {
      return value;
    }

    if (Number.isNaN(Number(value)) ) {
      return '-'
    }
    else {
      return Number(value);
    }
  }


  private isOperationColumn(scenario: string) {
    return scenario == "operation";
  }


  /**
   * converts Scenario to CSS class
   *
   * @param scenario
   * @param value
   */
  private translateScenarioCSS(scenario: string, value: number): string {
    let scenarios = new VarianceScenario(scenario);
    let prefix = "pos";

    if (value <  0) {
      prefix = "neg";
    }

    if (scenarios.isValid) {
      return prefix + "_" +scenarios.direction + (scenarios.type == 'dr' ? " relative_variance" : "");
    }

    return scenario;

  }


  private setCellType(scenario: string, scenariosUnitType: DataFormat) {

    if( scenario === 'category'){
      return "";
    }

    let unitType: string;
    let scenarios  =new VarianceScenario(scenario);

    if ( scenariosUnitType == DataFormat.PERCENT){
      unitType = "percent";

      if (scenarios.isValid && scenarios.type == 'd') {
        unitType = "decimal";
      }
    }

    else {
      unitType = "decimal";

      if (scenarios.isValid && scenarios.type == 'dr') {
        unitType = "percent";
      }
    }

    return unitType;
  }


  private isDrillElementCategory(type: string,   scenario: string) {
    return "DRILLELEMENT" === type && "category" === scenario;
  }

  private isPartElementCategory(type: string,  scenario: string) {
    return "PARTELEMENT" === type && "category" === scenario;
  }


  private isSumElementCategory(type: string,  scenario: string) {
    return ("GROUP_SUM" === type || "SUM" === type) && "category" === scenario;
  }


  private isEntryCategory(type: string, scenario: string) {
    return "ENTRY" === type && "category" === scenario;
  }

  private isGroupHeadCategory(type: string,  scenario: string) {
    return "GROUPHEAD" === type && "category" === scenario;
  }

  private translateCellPrefix(i18n: Map<string | number, string>, type: any, scenario: string) {
    if (this.isOperationColumn(scenario)){
      return null;
    }

    if (this.isGroupHeadCategory(type, scenario)) {
      return null;
    }

    if (this.isEntryCategory(type,  scenario)) {
     return null;
    }

    if (this.isDrillElementCategory(type,  scenario)) {
      return `${i18n.get("there_of")} `;
    }

    if (this.isPartElementCategory(type,  scenario)) {
      // translate allways because of default sum symbol.
      return  `${i18n.get("part_of")} `;
    }

    return null;

  }

  private createColumnType(scenario: { name: string; group: string; type: string }) {

    if (scenario.name == scenario.group && scenario.name == scenario.type) {
      return "base"
    }

    if (scenario.name == scenario.group) {
      return "columnGroup"
    }

    return "columnSubGroup"
  }
}
