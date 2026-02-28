import { StringAdapter } from "../helper/StringAdapter";
import { IAdapter } from "../helper/IAdapter";
import { AdapterUtils } from "../helper/AdapterUtils";

export enum OrderDirection {
  ASC = "asc",
  DESC = "desc",
}

/** Valid columns for ORDER BY in AlaSQL queries — includes hierarchy dimensions and all 16 scenario slots. */
export enum OrderColumn {
  ROWGROUP = "rowGroup",
  ROWGROUPINDEX = "rowGroupIndex",
  CATEGORY = "category",
  CATEGORYINDEX = "categoryIndex",
  SUBCATEGORY = "subCategory",
  SUBCATEGORYINDEX = "subCategoryIndex",
  AC1 = "ac1",
  AC2 = "ac2",
  AC3 = "ac3",
  AC4 = "ac4",
  PP1 = "pp1",
  PP2 = "pp2",
  PP3 = "pp3",
  PP4 = "pp4",
  FC1 = "fc1",
  FC2 = "fc2",
  FC3 = "fc3",
  FC4 = "fc4",
  PL1 = "pl1",
  PL2 = "pl2",
  PL3 = "pl3",
  PL4 = "pl4",
}

export class Order {
  /**
   * @param hierarchy Columns for multi-level sorting, applied left-to-right (e.g. `["rowGroup", "category"]`).
   * @param direction Sort direction applied to all hierarchy levels.
   */
  constructor(
    public hierarchy: string[] = ["category"],
    public direction: OrderDirection = OrderDirection.ASC,
  ) {}
}

export class OrderAdapter implements IAdapter<Order> {
  constructor(private stringAdapter: StringAdapter) {}

  adapt(data: Record<string, unknown>): Order {
    const hierarchy: string[] = AdapterUtils.adaptArray(data.hierarchy, this.stringAdapter);

    const order: OrderDirection =
      OrderDirection[data.direction?.toUpperCase() as keyof typeof OrderDirection] || OrderDirection.ASC;

    return new Order(
      hierarchy.map((str) => OrderColumn[str.toUpperCase() as keyof typeof OrderColumn] || OrderColumn.CATEGORY),
      order,
    );
  }

  default(): Order {
    return new Order(["category"], OrderDirection.ASC);
  }
}
