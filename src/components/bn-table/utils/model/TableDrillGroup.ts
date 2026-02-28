// import { IAdapter } from "../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../utils/helper/CompareUtil";

import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";

/**
 * Filter definition for a table drill-down operation (thereOf or partOf).
 *
 * Identifies which rows in the dataset participate in a drill-down group by matching
 * on the three-level row hierarchy. For partOf drill-downs, the {@link partOf} field
 * names the parent category whose total is used as the 100% reference.
 */
export class TableDrillGroup {
  public rowGroup: string = "";
  public category: string = "";
  public subCategory: string = "";
  /** Parent category name for percentage-of-total (partOf) calculations. Empty for thereOf groups. */
  public partOf: string = "";

  constructor() {}
}

/** Converts untyped JSON into a validated {@link TableDrillGroup}. */
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
