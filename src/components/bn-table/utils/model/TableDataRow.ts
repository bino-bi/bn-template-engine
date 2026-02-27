// import { IAdapter } from "../../../../utils/helper/IAdapter";
// import { CompareUtil } from "../../../../utils/helper/CompareUtil";

import { CompareUtil } from "../../../../utils/helper/CompareUtil";
import { IAdapter } from "../../../../utils/helper/IAdapter";

export class TableDataRow {
  public operation: string = "+";
  public rowGroup: string | null | undefined;
  public rowGroupIndex: number | null | undefined;
  public category: string | null | undefined;
  public categoryIndex: number | null | undefined;
  public subCategory: string | null | undefined;
  public subCategoryIndex: number | null | undefined;
  public columnGroup: string | null | undefined;
  public columnGroupIndex: number | null | undefined;
  public columnSubGroup: string | null | undefined;
  public columnSubGroupIndex: number | null | undefined;
  public ac1: number | null | undefined;
  public ac2: number | null | undefined;
  public ac3: number | null | undefined;
  public ac4: number | null | undefined;
  public pp1: number | null | undefined;
  public pp2: number | null | undefined;
  public pp3: number | null | undefined;
  public pp4: number | null | undefined;
  public fc1: number | null | undefined;
  public fc2: number | null | undefined;
  public fc3: number | null | undefined;
  public fc4: number | null | undefined;
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
