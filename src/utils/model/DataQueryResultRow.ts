/**
 * A single row in the table query result. The index signature holds dynamic scenario
 * values (ac1, pl1, dac1_pl1_pos, etc.) resolved at query time.
 *
 * `type` identifies the row's role:
 * - `ENTRY`: regular data row
 * - `GROUPHEAD`: group header (label only, no values)
 * - `GROUP_SUM`: subtotal for a row group
 * - `SUM`: grand total row
 * - `DRILLELEMENT`: thereof drill-down detail row
 * - `PARTELEMENT`: partOf percentage row
 */
export interface DataQueryResultRow {
  type?: string;
  rowGroup?: string;
  category?: string;
  subCategory?: string;
  rowNr?: number;
  rowGroupIndex?: number;
  /** `"+"` or `"-"` - determines if values add to or subtract from group aggregations. */
  operation?: string;
  [key: string]: string | number | null | undefined;
}

/** Category count per row group - used for pagination and rendering row group headers. */
export interface DataQueryMetaRow {
  totalRowCnt: number;
  rowGroup?: string;
  rowGroupIndex?: number;
}
