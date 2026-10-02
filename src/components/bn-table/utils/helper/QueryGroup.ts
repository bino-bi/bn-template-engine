import { TableType } from "../model";
// import {QueryColumnNames} from "../../../../utils/model";
import { TableComponentConfig } from "../model/TableComponentConfig";
import { QueryColumnNames } from "../../../../utils/model";

/** '', null and a missing rowGroup are one group. */
export const BLANK_SAFE_ROWGROUP = `IFNULL(${QueryColumnNames.ROWGROUP}, '')`;

/**
 * Manages the GROUP BY column list for DataQuery's SQL statements.
 *
 * The `transformOperator` AlaSQL UDF (which maps `"+"`/`"-"` to +1/-1 for
 * sign-aware SUMs) is registered globally by `scopedDb.ts` when the shared
 * database is created - no per-component registration is needed here.
 *
 * The GROUP BY columns are composed dynamically: always category + categoryIndex,
 * plus operation for OPT types, plus rowGroup/rowGroupIndex when grouping is active.
 */
export class QueryGroups {
  private groups: string[];

  constructor(config: TableComponentConfig) {
    this.groups = [QueryColumnNames.CATEGORY as string, QueryColumnNames.CATEGORYINDEX as string];

    if (TableType.OPT === config.type || TableType.OPTNOTOTAL === config.type) {
      this.groups.unshift(QueryColumnNames.OPERATION as string);
    }

    if (config.grouped) {
      this.groups.push(QueryColumnNames.ROWGROUP as string);
      this.groups.push(QueryColumnNames.ROWGROUPINDEX as string);
    }
  }

  /** GROUP BY list. */
  toString(): string {
    return this.groups.map((s) => (s === QueryColumnNames.ROWGROUP ? BLANK_SAFE_ROWGROUP : s)).toString();
  }

  /** SELECT list for the GROUP BY columns. */
  select(): string {
    return this.groups.map((s) => (s === QueryColumnNames.ROWGROUP ? `${BLANK_SAFE_ROWGROUP} as ${s}` : s)).toString();
  }

  noCategory(): string[] {
    return this.groups.filter((element) => element !== (QueryColumnNames.CATEGORY as string));
  }

  toArray(): string[] {
    return this.groups;
  }
}
