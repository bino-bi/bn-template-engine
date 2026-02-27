import { QueryGroups } from "./QueryGroup";
import { TableType } from "../model";
import { TableComponentConfig } from "../model/TableComponentConfig";
import { Order } from "../../../../components";
import { DataFormat, I18nMode, TableCategoryWidth, MeasureType } from "../../../../utils/constants";
import { SiPrefix } from "../../../../utils/model/SiPrefix";

describe("DQueryGroup Test", () => {
  const config: TableComponentConfig = {
    title: "",
    scenarios: [],
    scenariosUnitType: DataFormat.DECIMAL,
    grouped: true, // Array<string | GroupSelection>| null;
    showGroupTitle: false,
    thereOf: [],
    categoryThereOf: new Map(),
    partOf: [],
    order: new Order(),
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

    expect(queryGroup.toString()).toEqual("operation,category,categoryIndex,rowGroup,rowGroupIndex");
  });
});
