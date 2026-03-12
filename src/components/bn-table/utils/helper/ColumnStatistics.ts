import { ColumnStats } from "../elements/Cell";
import { DataQueryResultRow } from "../../../../utils/model/DataQueryResultRow";

/**
 * Utility class to calculate min/max statistics per column for bar chart scaling.
 */
export class ColumnStatistics {
  /**
   * Calculate min, max, and absMax for specified columns from query result data.
   *
   * @param data - Array of data rows from the query result
   * @param columns - Array of column names to calculate statistics for
   * @returns Map of column name to statistics
   */
  public calculate(data: DataQueryResultRow[][], columns: string[]): Map<string, ColumnStats> {
    const statsMap = new Map<string, ColumnStats>();

    if (!columns || columns.length === 0 || !data || data.length === 0) {
      return statsMap;
    }

    for (const column of columns) {
      let min = Infinity;
      let max = -Infinity;
      const absValues: number[] = [];

      for (const group of data) {
        for (const row of group) {
          const value = this.extractValue(row, column);
          if (value !== null && !isNaN(value)) {
            min = Math.min(min, value);
            max = Math.max(max, value);
            absValues.push(Math.abs(value));
          }
        }
      }

      // Handle case where no valid values were found
      if (min === Infinity || max === -Infinity) {
        min = 0;
        max = 0;
      }

      const absMax = Math.max(Math.abs(min), Math.abs(max));

      let median = 0;
      if (absValues.length > 0) {
        absValues.sort((a, b) => a - b);
        const mid = Math.floor(absValues.length / 2);
        median = absValues.length % 2 === 0 ? (absValues[mid - 1] + absValues[mid]) / 2 : absValues[mid];
      }

      statsMap.set(column, { min, max, absMax, median });
    }

    return statsMap;
  }

  /**
   * Extract the numeric value from a row for a given column.
   * Handles both direct column access and the special naming conventions
   * used in the table (e.g., "dr##ac1_pp1_pos").
   */
  private extractValue(row: DataQueryResultRow, column: string): number | null {
    // Try direct access first
    if (row[column] !== undefined) {
      const val = Number(row[column]);
      return isNaN(val) ? null : val;
    }

    // Try the scenario column naming pattern
    // For variance columns, they might be stored with scenario## prefix
    for (const key of Object.keys(row)) {
      if (key === column || key.endsWith("##" + column) || key.includes("##" + column)) {
        const val = Number(row[key]);
        if (!isNaN(val)) {
          return val;
        }
      }
    }

    return null;
  }
}
