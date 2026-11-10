import { QueryGroups } from "./QueryGroup";
import { TableType, ThereofPosition } from "../model";
import { TableComponentConfig } from "../model/TableComponentConfig";
import { Order } from "../../../../utils/model/Order";
import { DataFormat, I18nMode, TableCategoryWidth, MeasureType } from "../../../../utils/constants";
import { SiPrefix } from "../../../../utils/model/SiPrefix";

describe("DQueryGroup Test", () => {
  const config: TableComponentConfig = {
    title: "",
    scenarios: [],
    scenariosUnitType: DataFormat.DECIMAL,
    grouped: true, // Array<string | GroupSelection>| null;
    showGroupTitle: false,
    runningSum: false,
    varianceWaterfall: false,
    thereOf: [],
    thereOfPosition: ThereofPosition.BELOW,
    categoryThereOf: new Map(),
    partOf: [],
    attributes: [],
    sortOrder: new Order(),
    type: TableType.OPTNOTOTAL,
    limit: 100,
    i18n: I18nMode.ALL,
    categoryWidth: TableCategoryWidth.W100,
    measureScale: new SiPrefix(),
    measureType: MeasureType.VOLUME,
    measureUnit: "",
    showMeasureScale: false,
    filter: "",
    barColumns: [],
    interval: "none",
    categoryIntervalPosition: 0,
    locale: "de",
  };

  it("should return noCategory array", () => {
    const queryGroup = new QueryGroups(config);
    expect(queryGroup.noCategory()).toEqual(["operation", "categoryIndex", "rowGroup", "rowGroupIndex"]);
  });

  it("should return array", () => {
    const queryGroup = new QueryGroups(config);

    expect(queryGroup.toArray()).toEqual(["operation", "category", "categoryIndex", "rowGroup", "rowGroupIndex"]);
  });

  it("should return string", () => {
    const queryGroup = new QueryGroups(config);

    expect(queryGroup.toString()).toEqual("operation,category,categoryIndex,IFNULL(rowGroup, ''),rowGroupIndex");
  });

  it("should return the select list with the rowGroup alias", () => {
    const queryGroup = new QueryGroups(config);

    expect(queryGroup.select()).toEqual(
      "operation,category,categoryIndex,IFNULL(rowGroup, '') as rowGroup,rowGroupIndex",
    );
  });
});
