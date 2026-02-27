import alasql from "alasql";
import { TableType } from "../model";
// import {QueryColumnNames} from "../../../../utils/model";
import { TableComponentConfig } from "../model/TableComponentConfig";
import { QueryColumnNames } from "../../../../utils/model";

export class QueryGroups {
  private groups: string[];

  constructor(config: TableComponentConfig) {
    alasql.fn.transformOperator = function (a) {
      return a == "-" ? -1 : 1;
    };

    // prepares category names usesd for query depending on config
    // grpips RAW is a array of Gorups while groups are

    this.groups = [QueryColumnNames.CATEGORY as string, QueryColumnNames.CATEGORYINDEX as string];

    if (TableType.OPT === config.type || TableType.OPTNOTOTAL === config.type) {
      this.groups.unshift(QueryColumnNames.OPERATION as string);
    }

    if (config.grouped) {
      this.groups.push(QueryColumnNames.ROWGROUP as string);
      this.groups.push(QueryColumnNames.ROWGROUPINDEX as string);
    }
  }

  toString(): string {
    return this.groups.map((s) => `${s}`).toString();
  }

  noCategory(): string[] {
    return this.groups.filter((element) => element !== (QueryColumnNames.CATEGORY as string));
  }

  toArray(): string[] {
    return this.groups;
  }
}
