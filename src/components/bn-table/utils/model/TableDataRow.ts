// import { IAdapter } from "../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../utils/helper/CompareUtil";

import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";

/**
 * IBCS-compliant data row for table visualizations.
 *
 * Represents a single record with a three-level row hierarchy (rowGroup > category > subCategory),
 * a two-level column hierarchy (columnGroup > columnSubGroup), and 16 scenario value slots across
 * four scenario types: actual (ac1-4), previous period (pp1-4), forecast (fc1-4), and plan (pl1-4).
 *
 * The {@link operation} field controls how this row participates in aggregations:
 * `"+"` adds and `"-"` subtracts the row's values. This is converted to a numeric multiplier
 * by `transformOperator()` in the SQL query engine.
 */
export class TableDataRow {
  /** Aggregation operator: `"+"` adds values, `"-"` subtracts them in SUM/OPT roll-ups. */
  public operation: string = "+";

  // --- Three-level row hierarchy ---
  public rowGroup: string | null | undefined;
  /** Sort/display order within the row group level. */
  public rowGroupIndex: number | null | undefined;
  public category: string | null | undefined;
  /** Sort/display order within the category level. */
  public categoryIndex: number | null | undefined;
  public subCategory: string | null | undefined;
  /** Sort/display order within the sub-category level. */
  public subCategoryIndex: number | null | undefined;

  // --- Two-level column hierarchy ---
  public columnGroup: string | null | undefined;
  public columnGroupIndex: number | null | undefined;
  public columnSubGroup: string | null | undefined;
  public columnSubGroupIndex: number | null | undefined;

  // --- IBCS scenario slots (4 per type) ---
  /** Actual values (ac1-ac4) -- reported/measured figures. */
  public ac1: number | null | undefined;
  public ac2: number | null | undefined;
  public ac3: number | null | undefined;
  public ac4: number | null | undefined;
  /** Previous period values (pp1-pp4) -- prior year/period comparisons. */
  public pp1: number | null | undefined;
  public pp2: number | null | undefined;
  public pp3: number | null | undefined;
  public pp4: number | null | undefined;
  /** Forecast values (fc1-fc4) -- projected/estimated figures. */
  public fc1: number | null | undefined;
  public fc2: number | null | undefined;
  public fc3: number | null | undefined;
  public fc4: number | null | undefined;
  /** Plan/budget values (pl1-pl4) -- target figures. */
  public pl1: number | null | undefined;
  public pl2: number | null | undefined;
  public pl3: number | null | undefined;
  public pl4: number | null | undefined;

  constructor() {}

  public addRowGroup(name: string, index: number) {
    this.rowGroup = name;
    this.rowGroupIndex = index;
  }

  public addCategory(name: string, index: number) {
    this.category = name;
    this.categoryIndex = index;
  }

  public addSubCategory(name: string, index: number) {
    this.subCategory = name;
    this.subCategoryIndex = index;
  }

  public addColumnGroup(name: string, index: number) {
    this.columnGroup = name;
    this.columnGroupIndex = index;
  }

  public addSubColumnGroup(name: string, index: number) {
    this.columnSubGroup = name;
    this.columnSubGroupIndex = index;
  }
}

/**
 * Converts untyped JSON records into validated {@link TableDataRow} instances.
 *
 * Only assigns fields that pass type validation via {@link CompareUtil}, so malformed
 * input data is silently dropped and defaults are preserved.
 */
export class TableDataRowAdapter implements IAdapter<TableDataRow> {
  constructor() {}

  adapt(data: Record<string, unknown>): TableDataRow {
    const dataRow: TableDataRow = new TableDataRow();

    if (CompareUtil.isOperator(data.operation)) {
      dataRow.operation = data.operation;
    }

    if (CompareUtil.isNumber(data.rowGroupIndex) && CompareUtil.isString(data.rowGroup)) {
      dataRow.addRowGroup(data.rowGroup, data.rowGroupIndex);
    }

    if (CompareUtil.isNumber(data.categoryIndex) && CompareUtil.isString(data.category)) {
      dataRow.addCategory(data.category, data.categoryIndex);
    }

    if (CompareUtil.isNumber(data.subCategoryIndex) && CompareUtil.isString(data.subCategory)) {
      dataRow.addSubCategory(data.subCategory, data.subCategoryIndex);
    }

    if (CompareUtil.isNumber(data.columnGroupIndex) && CompareUtil.isString(data.columnGroup)) {
      dataRow.addColumnGroup(data.columnGroup, data.columnGroupIndex);
    }

    if (CompareUtil.isNumber(data.columnSubGroupIndex) && CompareUtil.isString(data.columnSubGroup)) {
      dataRow.addSubColumnGroup(data.columnSubGroup, data.columnSubGroupIndex);
    }

    this.setActualValues(data, dataRow);
    this.setPlanValues(data, dataRow);
    this.setPreviousPeriodValues(data, dataRow);
    this.setForecastValues(data, dataRow);

    return dataRow;
  }

  default(): TableDataRow {
    return new TableDataRow();
  }

  private setActualValues(data: Record<string, unknown>, dataRow: TableDataRow) {
    if (CompareUtil.isNumber(data.ac1)) {
      dataRow.ac1 = data.ac1;
    }

    if (CompareUtil.isNumber(data.ac2)) {
      dataRow.ac2 = data.ac2;
    }

    if (CompareUtil.isNumber(data.ac3)) {
      dataRow.ac3 = data.ac3;
    }

    if (CompareUtil.isNumber(data.ac4)) {
      dataRow.ac4 = data.ac4;
    }
  }

  private setPlanValues(data: Record<string, unknown>, dataRow: TableDataRow) {
    if (CompareUtil.isNumber(data.pp1)) {
      dataRow.pp1 = data.pp1;
    }

    if (CompareUtil.isNumber(data.pp2)) {
      dataRow.pp2 = data.pp2;
    }

    if (CompareUtil.isNumber(data.pp3)) {
      dataRow.pp3 = data.pp3;
    }

    if (CompareUtil.isNumber(data.pp4)) {
      dataRow.pp4 = data.pp4;
    }
  }

  private setPreviousPeriodValues(data: Record<string, unknown>, dataRow: TableDataRow) {
    if (CompareUtil.isNumber(data.pl1)) {
      dataRow.pl1 = data.pl1;
    }

    if (CompareUtil.isNumber(data.pl2)) {
      dataRow.pl2 = data.pl2;
    }

    if (CompareUtil.isNumber(data.pl3)) {
      dataRow.pl3 = data.pl3;
    }

    if (CompareUtil.isNumber(data.pl4)) {
      dataRow.pl4 = data.pl4;
    }
  }

  private setForecastValues(data: Record<string, unknown>, dataRow: TableDataRow) {
    if (CompareUtil.isNumber(data.fc1)) {
      dataRow.fc1 = data.fc1;
    }

    if (CompareUtil.isNumber(data.fc2)) {
      dataRow.fc2 = data.fc2;
    }

    if (CompareUtil.isNumber(data.fc3)) {
      dataRow.fc3 = data.fc3;
    }

    if (CompareUtil.isNumber(data.fc4)) {
      dataRow.fc4 = data.fc4;
    }
  }
}
