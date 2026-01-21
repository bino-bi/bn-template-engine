/**
 * Header configuration types and parsing utilities for bn-grid component.
 */

export interface HeaderItem {
  label: string;
  id: string;
}

export interface GridConfig {
  rows: HeaderItem[];
  columns: HeaderItem[];
}

/**
 * Parses a JSON string of headers into HeaderItem array.
 * Supports both simple string arrays and objects with id/label properties.
 *
 * Examples:
 * - Simple: '["Electronics", "Furniture"]'
 * - With IDs: '[{"label": "Electronics", "id": "elec"}, {"label": "Furniture", "id": "furn"}]'
 *
 * @param json - JSON string containing header definitions
 * @returns Array of HeaderItem objects
 */
export function parseHeaders(json: string): HeaderItem[] {
  if (!json || json.trim() === '' || json === '[]') {
    return [];
  }

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item, index) => {
      if (typeof item === 'string') {
        // Simple string - use index as ID
        return {
          label: item,
          id: String(index)
        };
      } else if (typeof item === 'object' && item !== null) {
        // Object with label and optional id
        const label = item.label ?? item.name ?? String(index);
        const id = item.id ?? String(index);
        return { label, id };
      }

      // Fallback for unexpected types
      return {
        label: String(item),
        id: String(index)
      };
    });
  } catch {
    return [];
  }
}

/**
 * Parses both row and column headers into a GridConfig.
 *
 * @param rowHeaders - JSON string for row headers
 * @param columnHeaders - JSON string for column headers
 * @returns GridConfig object with parsed rows and columns
 */
export function parseGridConfig(rowHeaders: string, columnHeaders: string): GridConfig {
  return {
    rows: parseHeaders(rowHeaders),
    columns: parseHeaders(columnHeaders)
  };
}

/**
 * Generates a slot name for a cell based on row and column indices.
 * Uses IDs if available (e.g., "elec-inv"), otherwise uses indices (e.g., "0-1").
 *
 * @param row - Row HeaderItem
 * @param col - Column HeaderItem
 * @returns Slot name string
 */
export function getSlotName(row: HeaderItem, col: HeaderItem): string {
  return `${row.id}-${col.id}`;
}

/**
 * Validates the headers JSON string.
 *
 * @param json - JSON string to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateHeadersJson(json: string): string[] {
  if (!json || json.trim() === '' || json === '[]') {
    return [];
  }

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      return ['Headers must be an array'];
    }

    const errors: string[] = [];
    const ids = new Set<string>();

    parsed.forEach((item, index) => {
      if (typeof item === 'object' && item !== null && item.id !== undefined) {
        if (typeof item.id !== 'string') {
          errors.push(`Header[${index}]: 'id' must be a string`);
        } else if (ids.has(item.id)) {
          errors.push(`Header[${index}]: duplicate id '${item.id}'`);
        } else {
          ids.add(item.id);
        }

        if (item.label !== undefined && typeof item.label !== 'string') {
          errors.push(`Header[${index}]: 'label' must be a string`);
        }
      }
    });

    return errors;
  } catch {
    return ['Invalid JSON structure'];
  }
}
