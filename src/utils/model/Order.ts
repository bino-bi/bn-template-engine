import { StringAdapter } from "../helper/StringAdapter";
import { IAdapter } from "../helper/IAdapter";
import { AdapterUtils } from "../helper/AdapterUtils";

export enum OrderDirection {
  ASC = "asc",
  DESC = "desc",
}

/** Valid columns for ORDER BY in AlaSQL queries - includes hierarchy dimensions and all 16 scenario slots. */
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

/** A parsed bn-table order token: a dimension, a scenario or a variance, the last two optionally with an `@bucket`. */
export interface OrderToken {
  kind: "dim" | "scenario" | "variance";
  /** OrderColumn value for a dim, the scenario name, or the variance without sentiment (`dac1_pp1`). */
  column: string;
  type?: "d" | "dr";
  base?: string;
  delta?: string;
  /** Interval setname bucket after `@`, trimmed. */
  bucket?: string;
}

const DIM_COLUMNS: string[] = [
  OrderColumn.ROWGROUP,
  OrderColumn.ROWGROUPINDEX,
  OrderColumn.CATEGORY,
  OrderColumn.CATEGORYINDEX,
  OrderColumn.SUBCATEGORY,
  OrderColumn.SUBCATEGORYINDEX,
];
const ORDER_SCENARIO_REGEX = /^(?:ac|fc|pp|pl)[1-4]$/;
const ORDER_VARIANCE_REGEX = /^(dr|d)((?:ac|fc|pp|pl)[1-4])_((?:ac|fc|pp|pl)[1-4])(?:_(?:pos|neg|neu|opinv|op))?$/;

/** Parses one bn-table order token, case-insensitive except for the bucket. undefined: not a valid token. */
export function parseOrderToken(token: string): OrderToken | undefined {
  if (token == null) {
    return undefined;
  }
  const at = token.indexOf("@");
  const head = (at < 0 ? token : token.slice(0, at)).trim().toLowerCase();
  const bucket = at < 0 ? undefined : token.slice(at + 1).trim();
  if (bucket === "") {
    return undefined;
  }

  const dim = OrderColumn[head.toUpperCase() as keyof typeof OrderColumn];
  if (dim != null && DIM_COLUMNS.includes(dim)) {
    return bucket === undefined ? { kind: "dim", column: dim } : undefined;
  }
  if (ORDER_SCENARIO_REGEX.test(head)) {
    return { kind: "scenario", column: head, bucket };
  }
  const variance = ORDER_VARIANCE_REGEX.exec(head);
  if (variance != null) {
    const [, type, base, delta] = variance;
    return { kind: "variance", column: `${type}${base}_${delta}`, type: type as "d" | "dr", base, delta, bucket };
  }
  return undefined;
}

/** Normalized form of a bn-table order token (`column[@bucket]`), undefined when it does not parse. */
export function normalizeOrderToken(token: string): string | undefined {
  const parsed = parseOrderToken(token);
  if (parsed == null) {
    return undefined;
  }
  return parsed.bucket === undefined ? parsed.column : `${parsed.column}@${parsed.bucket}`;
}

export class OrderAdapter implements IAdapter<Order> {
  /** @param allowMeasures bn-table only: keep variance and `@bucket` tokens instead of mapping them to category. */
  constructor(
    private stringAdapter: StringAdapter,
    private allowMeasures: boolean = false,
  ) {}

  adapt(data: Record<string, unknown>): Order {
    const hierarchy: string[] = AdapterUtils.adaptArray(data.hierarchy, this.stringAdapter);

    const order: OrderDirection =
      OrderDirection[(data.direction as string)?.toUpperCase() as keyof typeof OrderDirection] || OrderDirection.ASC;

    return new Order(
      hierarchy.map(
        (str) =>
          (this.allowMeasures
            ? normalizeOrderToken(str)
            : OrderColumn[str.toUpperCase() as keyof typeof OrderColumn]) || OrderColumn.CATEGORY,
      ),
      order,
    );
  }

  default(): Order {
    return new Order(["category"], OrderDirection.ASC);
  }
}
