import { TableCategoryWidth } from "../../../../utils/constants";
import {TableRowType} from "../model";
import {Cell, ColumnStats} from "./Cell";


export class TableRow {
  index: number;
  groupindex: number;
  type: TableRowType;
  cssStyle: string;
  elements: Cell[];


  constructor(index: number, groupIndex: number, type: TableRowType) {
    this.index = index;
    this.groupindex = groupIndex;
    this.type = type;
    this.cssStyle = this.initCssStyle();
    this.elements = [];
  }

  private initCssStyle(): string {
    switch (this.type) {
      case TableRowType.HEADER: {
        return "groupheader";
      }
      case TableRowType.SEPERATORLINE: {
        return "";
      }
      case TableRowType.DRILLELEMENT: {
        return "ofit";
      }
      case TableRowType.PARTELEMENT: {
        return "partof";
      }
      case TableRowType.STANDARD: {
        return "";
      }
      case TableRowType.SUM: {
        return "sum";
      }
      default: {
        return "";
      }
    }
  }

  public getCells(): Cell[] {
    return this.elements;
  }

  public createElement(value: string | number | null, scenario: string, columnType :string | null,  cellType: string | null, prefix: string  | null, cellStyle :string  | null, isSecondaryElement: boolean  | null, categoryWidth: TableCategoryWidth | null | undefined, measureScale: number  | null | undefined, isBarChart: boolean = false, columnStats?: ColumnStats) {
    let cssStyle = cellStyle;

    if(scenario == 'category' && categoryWidth != null){
       cssStyle = `category-${categoryWidth.toString()}`;
    }

    if (this.type == TableRowType.HEADER) {
      cssStyle = "headerlabel";
    } else if (this.type == TableRowType.SEPERATORLINE) {
      cssStyle = scenario;
    }

    if (this.type == TableRowType.PARTELEMENT) {

      if (cellType == 'percent' ) {
        value = '-';
      }
      if (scenario != 'category' && scenario != 'operation') {
        cellType = "percent"
        cssStyle = ""
      }
    }

    if(value == "-"){
      cssStyle = ""
    }

    let prefixStyle = "prefix-first";
    if(isSecondaryElement){
      prefixStyle = "prefix-second";
    }

    cssStyle = `${cssStyle}  ${columnType}`;

    const cell = new Cell(scenario, this.elements.length, value, cssStyle, cellType, prefix, prefixStyle, 1, measureScale);
    cell.isBarChart = isBarChart;
    cell.columnStats = columnStats;
    this.elements.push(cell);
  }

}
