// import { IAdapter } from "../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../utils/helper/CompareUtil";

import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";

export class TableDrillGroup {
  public rowGroup: string = "";
  public category: string = "";
  public subCategory: string = "";
  public partOf: string = "";

  constructor() {}
}

export class TableDrillGroupAdapter implements IAdapter<TableDrillGroup> {
  constructor() {}

  adapt(data: Record<string, unknown>): TableDrillGroup {
    const group: TableDrillGroup = new TableDrillGroup();

    if (CompareUtil.isString(data.rowGroup)) {
      group.rowGroup = data.rowGroup;
    }

    if (CompareUtil.isString(data.category)) {
      group.category = data.category;
    }

    if (CompareUtil.isString(data.subCategory)) {
      group.subCategory = data.subCategory;
    }

    if (CompareUtil.isString(data.partOf)) {
      group.partOf = data.partOf;
    }
    return group;
  }

  default(): TableDrillGroup {
    return new TableDrillGroup();
  }
}
