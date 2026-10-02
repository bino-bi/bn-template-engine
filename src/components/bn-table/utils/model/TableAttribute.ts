/** Aggregate functions supported in attribute expressions. */
export type TableAttributeFn = "set" | "first" | "last" | "min" | "max" | "avg" | "sum" | "lit";

const EXPRESSION_REGEX = /^\s*(set|first|last|min|max|avg|sum|lit)\(\s*(.*?)\s*\)\s*$/;
/** Field arguments must be plain identifiers - keeps user input out of SQL syntax. */
const FIELD_IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

const NUMERIC_FNS: readonly TableAttributeFn[] = ["min", "max", "avg", "sum"];

/**
 * A custom table column computed from dataset fields via an aggregate expression,
 * e.g. `set(_leiter)` or `sum(ac1)` (see the `attributes` prop on bn-table).
 *
 * The {@link label} is the user-facing header text and never enters SQL; queries
 * use the positional {@link alias} (`attr_0`, `attr_1`, ...) instead.
 */
export class TableAttribute {
  constructor(
    public readonly label: string,
    public readonly alias: string,
    public readonly fn: TableAttributeFn,
    public readonly arg: string,
  ) {}

  /** Numeric aggregates are formatted like scenario cells (measure scale + decimals). */
  get isNumeric(): boolean {
    return NUMERIC_FNS.includes(this.fn);
  }
}

/** Checks a single attribute expression string like "set(_leiter)" or "lit(Fix)". */
export function isValidAttributeExpression(expression: string): boolean {
  if (typeof expression !== "string") {
    return false;
  }
  const match = EXPRESSION_REGEX.exec(expression);
  if (!match) {
    return false;
  }
  const [, fn, arg] = match;
  if (fn === "lit") {
    return arg.length > 0;
  }
  return FIELD_IDENTIFIER_REGEX.test(arg);
}

/** Parses an attribute expression into a {@link TableAttribute}; null when invalid. */
export function parseTableAttributeExpression(label: string, alias: string, expression: string): TableAttribute | null {
  if (!isValidAttributeExpression(expression)) {
    return null;
  }
  const [, fn, arg] = EXPRESSION_REGEX.exec(expression);
  return new TableAttribute(label, alias, fn as TableAttributeFn, arg);
}
