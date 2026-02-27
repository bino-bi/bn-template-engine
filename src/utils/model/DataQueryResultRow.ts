export interface DataQueryResultRow {
  type?: string;
  rowGroup?: string;
  category?: string;
  subCategory?: string;
  rowNr?: number;
  rowGroupIndex?: number;
  operation?: string;
  [key: string]: string | number | null | undefined;
}

export interface DataQueryMetaRow {
  totalRowCnt: number;
  rowGroup?: string;
  rowGroupIndex?: number;
}
