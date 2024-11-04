import alasql from "alasql";
import {OrderDirection, TableType} from "../model";
import {QueryGroups} from "./QueryGroup";
// import {QueryColumnNames, VarianceScenario} from "../../../../utils/model";
import {TableComponentConfig} from "../model/TableComponentConfig";
import {TableDataRow} from "../model/TableDataRow";
import { Order } from "../../../../../components";
import { QueryColumnNames, VarianceScenario } from "../../../../../utils/model";
// import {Order} from "../../../../utils/model/Order"; // FIXME IOrder

export class DataQuery {

  private readonly config: TableComponentConfig;
  private hasPartOf: boolean = false;
  private i18n: Map<string | number, string>;

  constructor(config: TableComponentConfig, i18n: Map<string | number, string>) {
    this.config = config;
    this.i18n = i18n;
  }

  /**
   * prepares and queries Data based on the config.
   */
  public execute(data: TableDataRow[]): any {

    if (data.length == 0) {
      return [];
    }

    let queries: any[] = [];
    let sumGroupQueries: any[] = [];
    let res: any[] = [];

    let scenarios = this.config.scenarios.map((s) => this.translateScenarioSQL(s, false, this.config.type)).toString();
    let scenariosSUMQuery = this.config.scenarios.map((s) => this.translateScenarioSQL(s, true, this.config.type)).toString();
    let relativeScenarios = this.getRelativeScenarios()

    let groups: QueryGroups = new QueryGroups(this.config);
    let groupsAggregated = this.config.grouped ? [QueryColumnNames.ROWGROUP, QueryColumnNames.ROWGROUPINDEX ] : [];

    let order: [string, string] = ["", ""];
    if (this.config.order.hierarchy.length > 0) {
      order = this.createOrderString(this.config.order);
    }

    this.hasPartOf = this.checkConfigForPartOf();

    // meta defines groups and the number detail rows in each group
    // Bsp:  0: Object { totalrowcnt: 7, rowgroup: "Umsatz" }
    let meta = alasql(`SELECT COUNT(DISTINCT ${QueryColumnNames.CATEGORY}) as ${QueryColumnNames.TOTALROWCOUNT} ${groupsAggregated.length > 0 ? "," + groupsAggregated : ""}
                       FROM ? ${groupsAggregated.length > 0 ? "GROUP BY " + groupsAggregated : ""}  
                       ORDER BY ${order[0]}`, [data]);

    // Creates DataSelection for LIST
    meta.forEach((rowGroupEntry: any) => {
      // the following variables are 'helper sections' which are used to constuct dynamicly the sql statement depending of the given config
      // is grouping active?
      let queryWhereSection: string = (rowGroupEntry.rowGroup && rowGroupEntry.rowGroup.length > 0) ? `WHERE ${QueryColumnNames.ROWGROUP} = '${rowGroupEntry.rowGroup}'` : ``;
      // is limit active?
      let queryLimitSection: string = '';
      if (this.config.limit) {
        queryLimitSection = `LIMIT ${this.config.limit}`;
      }

      this.createGroupHeaderRow(rowGroupEntry, queries);
      this.createDataRow(queries, rowGroupEntry, groups, scenarios, queryWhereSection, order, queryLimitSection);
      this.createRestRow(rowGroupEntry, queries, groups, scenarios, queryWhereSection, order);
      this.createGroupSumRow(queries, sumGroupQueries, rowGroupEntry, scenariosSUMQuery, order);
    });

    this.createTotalSumRow(queries, sumGroupQueries, scenariosSUMQuery);



    // executes main queries
    let self = this;
    queries.forEach(function (query) {
      try {
        res.push(alasql(query, [data]));
      } catch (err) {
        console.log("ERROR::", err, "QUERRY::",query, "CONFIG",self.config, "QUERRYS",queries)
      }
    });



    this.detectNaNCells(this.config.scenarios, res);
    this.createThereOfDrillRows(scenarios, order, data, res);
    this.createPartOfDrillRows(scenarios, order, sumGroupQueries, data, res);

    this.createThereOfDrillColumns(this.config.categoryThereOf, data, res);

    this.calculateColumnGroupRest(res, this.config.categoryThereOf)
    this.calculateRelativeVariances(res, relativeScenarios);

    return res;
  }


  detectNaNCells(scenarios: any, res: any[]) {
    res.forEach((group) => {
      group.map((row: any) => { 
        scenarios.forEach((scenario: any) => {
          let varianceScenario = new VarianceScenario(scenario);
        
          if (varianceScenario.isValid  == true){
            if (row[varianceScenario.base +"_cnt"] == 0 || row[varianceScenario.delta +"_cnt"] == 0){            
              row[scenario] = Number.NaN;             
            }  
          } else {
            if (row[scenario +"_cnt"] == 0){            
              row[scenario] = Number.NaN;             
            }
          }            
        });  
        return row;
      });
    });
  }

  createPartOfDrillRows(scenarios: string, order: [string, string], sumGroupQueries: any[], data: TableDataRow[], res: any[]) {
    if (this.config.partOf == null || this.config.partOf.length == 0 || this.config.type == TableType.LIST || data == null || data.length == 0) {
      return;
    }

    let drillQueries = [];
    let resDrill: any[] = []; // set of drill (subquery result injected into resultset)

    if (this.config.type == TableType.OPT || this.config.type == TableType.OPTNOTOTAL) {
      drillQueries = this.createPartOfQuery(scenarios, order);
    } else {
      drillQueries = this.createPartOfQuery(scenarios, order);
    }

    drillQueries.forEach(function (query) {
      resDrill.push(...alasql(query, [data]));
    });

    let scenarioNames = this.exctractScenarioNames(scenarios);
    let rowGroupSumResultRows: any[] = []

    sumGroupQueries.forEach(function (query) {
      rowGroupSumResultRows.push(...alasql(query, [data]));
    });


    let rowGroupSumResultMap = new Map<string, any>();

    rowGroupSumResultRows.forEach(row => rowGroupSumResultMap.set(row[QueryColumnNames.ROWGROUP], row));

    resDrill = this.reduceResDrillByCategoryGroups(resDrill, scenarioNames);

    resDrill.forEach(function (drillItem) {
      scenarioNames.forEach(key => {
        try {
          drillItem[key] = drillItem[key] / rowGroupSumResultMap.get(drillItem[QueryColumnNames.ROWGROUP])[key];
        } catch (err) {
          drillItem[key] = Number.NaN;
        }
      });
    });

    this.injectDrillRowsToResultRows(resDrill, res);
  }

  private createRestRow(rowGroupEntry: any, querys: any[], groups: QueryGroups, scenarios: string, queryWhereSection: string, order: [string, string]) {
    // Generates REST Row; sumsup the Bottom (total number of rows - limit)
    if (rowGroupEntry.totalRowCnt - this.config.limit > 0 && this.config.limit !== 0) {
      let rest_scenarios = ', SUM(ac1) as ac1, SUM(pp1) as pp1, SUM(dpp1_ac1_pos) as dpp1_ac1_pos, SUM(drpp1_ac1_pos) as drpp1_ac1_pos, SUM(dr_pp1)';
      querys.push(`SELECT ${QueryColumnNames.ROWNR}, 1 as  ${QueryColumnNames.ROWGROUPINDEX} , 'ENTRY' as ${QueryColumnNames.TYPE}, 'NO_GROUP' as ${QueryColumnNames.ROWGROUP}, 'REST' as ${QueryColumnNames.CATEGORY} ${rest_scenarios} as dr_pp1 FROM`
        + ` (SELECT ROWNUM() AS ${QueryColumnNames.ROWNR}, ${querys.length} as  ${QueryColumnNames.ROWGROUPINDEX} , 'ENTRY' as ${QueryColumnNames.TYPE}, '${rowGroupEntry.rowGroup || "NO_GROUP"}' as ${QueryColumnNames.ROWGROUP}, ${groups} ${scenarios.length > 0 ? ",".concat(scenarios) : ""} FROM ? ${queryWhereSection} GROUP BY ${groups} ORDER BY ${order[0]})`
        + ` t WHERE t.rowNr > ${this.config.limit}`);
    }
  }

  private createDataRow(querys: any[], rowGroupEntry: any, groups: QueryGroups, scenarios: string, queryWhereSection: string, order: [string, string], queryLimitSection: string) {
    // Generates DataRows
    querys.push(`SELECT ROWNUM()                                  AS ${QueryColumnNames.ROWNR},
                        ${querys.length}                          as ${QueryColumnNames.ROWGROUPINDEX},
                        'ENTRY'                                   as ${QueryColumnNames.TYPE},
                        '${rowGroupEntry.rowGroup || "NO_GROUP"}' as ${QueryColumnNames.ROWGROUP},
                        '${QueryColumnNames.CATEGORYINDEX}',
                        ${groups}                                    ${scenarios.length > 0 ? ",".concat(scenarios) : ""}
                 FROM ? ${queryWhereSection}
                 GROUP BY ${groups}
                 ORDER BY ${order[0]} ${queryLimitSection}`);
  }

  private createGroupHeaderRow(rowGroupEntry: any, querys: any[]) {
    // Generates GroupHeader Row
    if (true === this.config.grouped) {
      let groupTitle: string = this.config.showGroupTitle ? `,'${rowGroupEntry.rowGroup}' as ${QueryColumnNames.CATEGORY}` : "";
      querys.push(`SELECT ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                          ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                          'GROUPHEAD'                 as ${QueryColumnNames.TYPE},
                          '${rowGroupEntry.rowGroup}' as ${QueryColumnNames.ROWGROUP} ${groupTitle}
                   FROM ?
                   GROUP BY '1'`);
    }
  }

  private createGroupSumRow(querys: any[], groupSumQuery: any[], rowGroupEntry: any, scenariosSUMQuery: string, order: [string, string]) {

    // Generates SUM Row; sumsup all rows of group
    if (true === this.config.grouped && (TableType.SUM === this.config.type || TableType.SUMNOTOTAL === this.config.type || TableType.OPT === this.config.type || TableType.OPTNOTOTAL === this.config.type)) {
      querys.push(`SELECT ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                          '='                         as ${QueryColumnNames.OPERATION},
                          '${rowGroupEntry.rowGroup}' as ${QueryColumnNames.ROWGROUP},
                          ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                          'GROUP_SUM'                 as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                   FROM ?
                   WHERE ${QueryColumnNames.ROWGROUP} = '${rowGroupEntry.rowGroup}'
                   ORDER BY ${order[0]} `);
      groupSumQuery.push(`SELECT ${querys.length}            as ${QueryColumnNames.ROWGROUPINDEX},
                                 '='                         as ${QueryColumnNames.OPERATION},
                                 '${rowGroupEntry.rowGroup}' as ${QueryColumnNames.ROWGROUP},
                                 ROWNUM()                    AS ${QueryColumnNames.ROWNR},
                                 'GROUP_SUM'                 as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                          FROM ?
                          WHERE ${QueryColumnNames.ROWGROUP} = '${rowGroupEntry.rowGroup}'
                          ORDER BY ${order[0]} `);
    }
  }

  private createTotalSumRow(querys: any[], sumGroupQueries: any, scenariosSUMQuery: string) {
    if (TableType.SUM === this.config.type || TableType.OPT === this.config.type) {

      let title = `${this.hasPartOf && this.config.grouped == false ? `${this.i18n.get('SUM_TOTAL') || 'SUM_TOTAL'} ` : ""}${this.config.title}`

      querys.push(`SELECT ${querys.length} as ${QueryColumnNames.ROWGROUPINDEX},
                          '${title}'       as ${QueryColumnNames.ROWGROUP},
                          '='              as ${QueryColumnNames.OPERATION},
                          'SUM'            as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                   FROM ?  `);
    }
    sumGroupQueries.push(`SELECT ${querys.length} as ${QueryColumnNames.ROWGROUPINDEX},
                                 'SUM_TOTAL'      as ${QueryColumnNames.ROWGROUP},
                                 '='              as ${QueryColumnNames.OPERATION},
                                 'SUM'            as ${QueryColumnNames.TYPE} ${scenariosSUMQuery.length > 0 ? ",".concat(scenariosSUMQuery) : ""}
                          FROM ?  `);
  }

  private reduceResDrillByCategoryGroups(resDrill: any[], scenarioNames: string[]) {
    // This is workarround because alasql is not merging the rows as expected.
    let tmpSumMap = new Map();
    resDrill.forEach(function (drillItem) {
      let key = drillItem.rowNr + drillItem.rowGroup + drillItem.type + drillItem.category;
      if (tmpSumMap.has(key)) {
        let element = tmpSumMap.get(key);
        scenarioNames.forEach(key => {
          try {
            element[key] += drillItem[key];
          } catch (e) {
          }
        });
      } else {
        tmpSumMap.set(key, drillItem);
      }
    });

    return [...tmpSumMap.values()];
  }

  private injectDrillRowsToResultRows(resDrill: any[], res: any[]) {

    // resDrill = resDrill.reverse();
    let numberOfElement = new Map<string, number>();
    if (this.config.grouped === true) {
      // finds ParentElement of Drill Element and injects into result arra
      resDrill.forEach(function (drillItem) {
        res.forEach(function (resSegment) {
          let index = resSegment.findIndex((e: any) => e.category === drillItem.category && e.rowGroup === drillItem.rowGroup);

          if (index >= 0) {
            if (numberOfElement.has(`${drillItem.category}_${drillItem.rowGroup}`)) {
              let num = numberOfElement.get(`${drillItem.category}_${drillItem.rowGroup}`) || 0;
              numberOfElement.set(`${drillItem.category}_${drillItem.rowGroup}`, num + 1);
            } else {
              numberOfElement.set(`${drillItem.category}_${drillItem.rowGroup}`, 1);
            }

            drillItem[QueryColumnNames.ROWNR] = numberOfElement.get(`${drillItem.category}_${drillItem.rowGroup}`);
            resSegment.splice(index + drillItem[QueryColumnNames.ROWNR], 0, drillItem);
          }
        });

      });
    } else {
      // if no grouped mode selected matching only searching for category not for groupname
      const duplicateSubCategoriesList = this.findDuplicateSubCategories(resDrill);
       
      resDrill.forEach(function (drillItem) {
        res.forEach(function (resSegment) {
          let index = resSegment.findIndex((e: any) => e.category != null && (e.category === drillItem.category));
            
          if (index >= 0) {
                    
            if (numberOfElement.has(`${drillItem.category}`)) {
              let num = numberOfElement.get(`${drillItem.category}`) || 0;
              numberOfElement.set(`${drillItem.category}`, num + 1);
  
            } else {
              numberOfElement.set(`${drillItem.category}`, 1);                 
            }
            
            if(drillItem[QueryColumnNames.ROWNR] == 1) {
                drillItem.subCategory = `${drillItem.subCategory} (${drillItem.rowGroup})`;  
            }

           else if(duplicateSubCategoriesList.includes(drillItem.subCategory)) {
              drillItem.subCategory = `${drillItem.subCategory} (${drillItem.rowGroup})`;  
          }
        
            resSegment.splice(index + drillItem[QueryColumnNames.ROWNR], 0, drillItem);

          }
        });
      })
    }
  }

  private createThereOfDrillRows(scenarios: string, order: [string, string], data: TableDataRow[], res: any[]) {
    // adds drill rows if setup in config
    // if there of is set drilldown row is displayed with absolute numbers,
    // if part of is also not null a relative percenatage based of the selected basis is displayed
    if (this.config.thereOf == undefined || this.config.thereOf.length == 0) {
      return;
    }

    let drillQueries: any[] = [];
    let resDrill: any[] = []; // set of drill (subquery result injected into resultset)
    // let rollgroups = ['category']; // frage wo kommt das her ?
    // create drill queryies based on config

    this.config.thereOf.forEach((element) => {
      let fromString = "1 <> 1";   // helper for strin concat  1<>1 OR ... OR ...
      fromString += ` OR (${QueryColumnNames.CATEGORY} = '${element.category}'`;

      if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
        // if not empty
        fromString += `and ${QueryColumnNames.ROWGROUP} = '${element.rowGroup}'`;
      }

      if (!(null == element.subCategory || 0 === element.subCategory.length || !element.subCategory.trim())) {
        // if not empty
        fromString += `and ${QueryColumnNames.SUBCATEGORY} = '${element.subCategory}'`;
      }
      fromString += `)`;

      drillQueries.push(`SELECT ROWNUM()                     AS ${QueryColumnNames.ROWNR},
                                null                         as operation,
                                'DRILLELEMENT'               as ${QueryColumnNames.TYPE},
                                ${QueryColumnNames.CATEGORY},
                                ${QueryColumnNames.SUBCATEGORY},
                                ${QueryColumnNames.ROWGROUP} as ${QueryColumnNames.ROWGROUP},
                                ${scenarios}
                         FROM ?
                         WHERE ${fromString}
                         GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}
                         ORDER BY ${order[1]}`);
    });

    // invertet Sort directon because the later used insertion which results into expected order direction
    //drillQueries.push(`SELECT ROWNUM() AS ${QueryColumnNames.ROWNR}, null as operation, 'DRILLELEMENT' as ${QueryColumnNames.TYPE}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}, ${QueryColumnNames.ROWGROUP}  as ${QueryColumnNames.ROWGROUP} , ${scenarios} FROM ? WHERE ${fromString} GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}  ORDER BY ${order[1]}`);

    drillQueries.forEach(function (query) {
      resDrill.push(...alasql(query, [data]));
    });

    this.injectDrillRowsToResultRows(resDrill, res);

  }

  private calculateRelativeVariances(res: any[], relativeScenarios: Map<any, any>) {
    res.forEach(group => {
      group.forEach((row: { [x: string]: any; }) => {
        if (row[QueryColumnNames.TYPE] !== "GROUPHEAD") {
          relativeScenarios.forEach((value: string, key: string) => {         
            row[key] = ((row[key] / row[value]));
          });
        }
      });
    });
  }

  private calculateColumnGroupRest(res: any[], categoryThereOf: Map<string, any>) {
    if (categoryThereOf == null || categoryThereOf.size == 0) {
      return;
    }
    let scenarioRestMap: Map<string, any> = new Map();

    categoryThereOf.forEach((value, key) => {
      let categoryDrills = value;
      let columnsList = [];
      for (let drillElement of categoryDrills) {
        columnsList.push(`${key}##${drillElement.name}`);
      }
      scenarioRestMap.set(key, columnsList);
    });

    res.forEach(group => {
      group.forEach((row: { [x: string]: any; }) => {
        if (row[QueryColumnNames.TYPE] !== "GROUPHEAD") {
          scenarioRestMap.forEach((values, key) => {
            let minuent = 0;
            values.forEach((value: any) => {
              if (row[value] != undefined) {
                minuent += row[value];
              }
            });
            row[`${key}##REST`] = row[key] - minuent;
          });
        }
      });
    });

  }

  private getRelativeScenarios() {
    let relativeScenarios = new Map();

    this.config.scenarios.forEach((s) => {
      let tmp = this.createRelativeScenario(s);
      if (tmp != null) {
        relativeScenarios.set(tmp.key, tmp.value);
      }
    });

    return relativeScenarios;
  }

  /**
   * converts technical scenario string into readable ibcs label
   *
   * @param scenario
   */
  private translateScenarioSQL(scenario: string, isSumRow: boolean, type: TableType): string {
    let scenarios = new VarianceScenario(scenario);

    if (TableType.OPT == type || TableType.OPTNOTOTAL == type) {
      if (scenarios.isValid) {
        if (scenarios.type == 'dr') {
          return `SUM(${scenarios.base} - ${scenarios.delta}) as ${scenario}, SUM(${scenarios.delta}) as dr_${scenarios.delta}`;
        } else {
          return `SUM(${scenarios.base} - ${scenarios.delta}) as ${scenario}`;
        }
      }
      
      if (isSumRow) {
        return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;
      }   

      return `SUM(${scenario}) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;
    }

    if (scenarios.isValid) {
      if (scenarios.type == 'dr') {
        return `SUM((${scenarios.base}  * transformOperator(operation)) - (${scenarios.delta}  * transformOperator(operation))) as ${scenario}, SUM(${scenarios.delta} * transformOperator(operation)) as dr_${scenarios.delta}`;
      } else {
        return `SUM((${scenarios.base}  * transformOperator(operation))- (${scenarios.delta} * transformOperator(operation))) as ${scenario}`;
      }
    }

    return `SUM(${scenario} * transformOperator(operation)) as ${scenario}, COUNT(ISNULL(${scenario})) as ${scenario}_cnt`;

  }

  /**
   * generates Tuple
   *  [0] orderby string example:   category asc
   *  [1] inverted order example:   category desc
   * @param orderComponent
   */
  private createOrderString(orderComponent: Order): [string, string] {
    let base = "";
    let inverted = "";

    base = `${orderComponent.hierarchy.toString()} ${orderComponent.direction}`;
    inverted = `${orderComponent.hierarchy.toString()} ${OrderDirection.ASC === orderComponent.direction ? OrderDirection.DESC : OrderDirection.ASC}`;
    return [base, inverted];
  }

  private createRelativeScenario(scenario: string) {
    let scenarios = new VarianceScenario(scenario);

    if (scenarios.isValid && scenarios.type == 'dr') {
      return {key: `${scenario}`, value: `dr_${scenarios.delta}`}
    }

    return null;
  }

  private exctractScenarioNames(scenarios: string): string[] {
    let scenarioNames: string[] = [];
    scenarios.split(',').forEach(item => item.length >= 2 ? scenarioNames.push(item.split('as')[1].trim()) : null);
    return scenarioNames;
  }


  private findDuplicateSubCategories(resDrill: any[]): string[] {
    const uniq = resDrill
      .map((element) => {
        return {
          count: 1,
          subCategory: element.subCategory
        }
      })
      .reduce((a: any, b: any) => {
        a[b.subCategory] = (a[b.subCategory] || 0) + b.count
        return a
      }, {})

    return Object.keys(uniq).filter((a) => uniq[a] > 1);

  }

  private createPartOfQuery(scenarios: string, order: [string, string]): string[] {
    let drillQueries = [];
    let fromString = "1 <> 1 ";   // helper for strin concat  1<>1 OR ... OR ...
    let groupName = ` ${QueryColumnNames.ROWGROUP}`;
    let rowNum = "ROWNUM()";

    this.config.partOf?.forEach((element) => {
      fromString += `OR (${QueryColumnNames.CATEGORY} = '${element.category}'`;
      if (!(null == element.rowGroup || 0 === element.rowGroup.length || !element.rowGroup.trim())) {
        // if not empty
        fromString += `and ${QueryColumnNames.ROWGROUP} = '${element.rowGroup}'`;
      }

      if (this.config.grouped == false) {
        groupName = ` 'SUM_TOTAL'  as ${QueryColumnNames.ROWGROUP} `
        rowNum = '1';
      }

      fromString += `)`;
    });

    // let dimensionGroups = `${QueryColumnNames.CATEGORY}, ${QueryColumnNames.SUBCATEGORY}, ${QueryColumnNames.ROWGROUP}`;
    // invertet Sort directon because the later used insertion which results into expected order direction
    drillQueries.push(`SELECT ${rowNum}     AS ${QueryColumnNames.ROWNR},
                              'PARTELEMENT' as ${QueryColumnNames.TYPE},
                              ${QueryColumnNames.CATEGORY},
                              ${groupName},
                              ${scenarios}
                       FROM ?
                       WHERE ${fromString}
                       GROUP BY ${QueryColumnNames.ROWGROUP}, ${QueryColumnNames.CATEGORY}, ${QueryColumnNames.TYPE}
                       ORDER BY ${order[1]}`);


    return drillQueries
  }

  private checkConfigForPartOf() {
    if (this.config.partOf == null || this.config.partOf.length == 0) {
      return false;
    }
    return true;
  }

  private createThereOfDrillColumns(categoryThereOf: Map<string, any>, data: TableDataRow[], res: any[]) {

    if (categoryThereOf == null || categoryThereOf.size == 0) {
      return;
    }

    let drillQueries: any[] = [];
    let resDrill: any[] = [];

    categoryThereOf.forEach((value, key) => {

      let whereClause = '1 <> 1 ';
      value.forEach((drillColumn: { name: any; }) => {
        whereClause += ` or columnGroup = '${drillColumn.name}' `
      });

      drillQueries.push(`SELECT 'ENTRY'                                    as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                rowGroup,
                                category,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, columnGroup, scenario`);
      drillQueries.push(`SELECT 'ENTRY'                                    as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                rowGroup,
                                category,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, columnGroup, columnSubGroup, scenario`);

      drillQueries.push(`SELECT 'DRILLELEMENT'                             as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                rowGroup,
                                category,
                                subCategory,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, subCategory, columnGroup, scenario`);
      drillQueries.push(`SELECT 'DRILLELEMENT'                             as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                rowGroup,
                                category,
                                subCategory,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, category, subCategory, columnGroup, columnSubGroup, scenario`);

      drillQueries.push(`SELECT 'GROUP_SUM'                                as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                rowGroup,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, columnGroup, scenario`);
      drillQueries.push(`SELECT 'GROUP_SUM'                                as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                rowGroup,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, rowGroup, columnGroup, columnSubGroup, scenario`);

      drillQueries.push(`SELECT 'SUM'                                      as rowlevel,
                                'COLUMNGROUP'                              as columnlevel,
                                columnGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, columnGroup, scenario`);
      drillQueries.push(`SELECT 'SUM'                                      as rowlevel,
                                'SUBGROUP'                                 as columnlevel,
                                columnGroup,
                                columnSubGroup,
                                '${key}'                                   as scenario,
                                sum(${key} * transformOperator(operation)) as val
                         FROM ?
                         WHERE ${whereClause}
                         GROUP BY rowlevel, columnGroup, columnSubGroup, scenario`);
    });


    for (const query of drillQueries) {
      resDrill.push(...alasql(query, [data]));
    }

    this.injectDrillColumnsToResultRows(resDrill, res);

  }

  private injectDrillColumnsToResultRows(resDrill: any[], res: any[]) {

    const separator = "##"
    for (const drillElement of resDrill) {
      for (const tableSegment of res) {
        for (const row of tableSegment) {
          if (row.type != drillElement.rowlevel) {
            continue;
          }

          if ('ENTRY' == drillElement.rowlevel) {
            if (drillElement.columnlevel == 'COLUMNGROUP' && row.category == drillElement.category) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (drillElement.columnlevel == 'SUBGROUP' && row.category == drillElement.category) {
              row[drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup] = drillElement.val;
            }
          } else if ('DRILLELEMENT' == drillElement.rowlevel) {

            if (drillElement.columnlevel == 'COLUMNGROUP' && row.category == drillElement.category && row.subCategory == drillElement.subCategory) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (drillElement.columnlevel == 'SUBGROUP' && row.category == drillElement.category && row.subCategory == drillElement.subCategory) {
              row[drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup] = drillElement.val;
            } else if (drillElement.columnlevel == 'COLUMNGROUP' && row.category == drillElement.category && row.subCategory == `${drillElement.subCategory} (${drillElement.rowGroup})`) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            } else if (drillElement.columnlevel == 'SUBGROUP' && row.category == drillElement.category && row.subCategory == `${drillElement.subCategory} (${drillElement.rowGroup})`) {
              row[drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup] = drillElement.val;
            }

          } else if ('SUM' == drillElement.rowlevel) {
            if (drillElement.columnlevel == 'COLUMNGROUP' && row.category == drillElement.category && row.subCategory == drillElement.subCategory) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            }
            if (drillElement.columnlevel == 'SUBGROUP' && row.category == drillElement.category && row.subCategory == drillElement.subCategory) {
              row[drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup] = drillElement.val;
            }
          } else if ('GROUP_SUM' == drillElement.rowlevel) {
            if (drillElement.columnlevel == 'COLUMNGROUP' && row.category == drillElement.category && row.subCategory == drillElement.subCategory) {
              row[drillElement.scenario + separator + drillElement.columnGroup] = drillElement.val;
            }
            if (drillElement.columnlevel == 'SUBGROUP' && row.category == drillElement.category && row.subCategory == drillElement.subCategory) {
              row[drillElement.scenario + separator + drillElement.columnGroup + separator + drillElement.columnSubGroup] = drillElement.val;
            }
          }
        }
      }
    }
  }


}
