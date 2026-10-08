/**
 * Per-context isolated AlaSQL database with a tiny pub/sub for table/view
 * data changes.
 *
 * Each `<bn-context>` owns one `ScopedDb`. `<bn-datasource>` and the static/
 * URL branches of `<bn-dataset>` register tables; the SQL branch of
 * `<bn-dataset>` registers views. Consumer components subscribe by name and
 * re-render when the producer calls `notify(name)`.
 *
 * @module context/scopedDb
 */
import alasql from "alasql";
import { DateTime } from "luxon";

/**
 * The part of an alasql database the engine uses. A local type on purpose:
 * the typings of alasql import a package it does not install, and this type
 * is part of the published type declarations.
 */
export interface AlaSQLDatabase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exec<T = any>(sql: string, params?: unknown[]): T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tables: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  views?: Record<string, any>;
  resetSqlCache(): void;
}

/**
 * Builds a SQL FROM-clause expression for a dataset, optionally filtered.
 *
 * Helpers (DataQuery, Table, StructureChart, TimeChart, dataAnalyzer) embed
 * this in their queries instead of accepting `[data]` array parameters, so
 * alasql doesn't have to ingest a fresh table on every call.
 */
export function buildFromExpr(tableName: string, filter?: string | null): string {
  if (filter != null && filter.length > 0) {
    // a rejected filter (the wrappers report ERR_filter) selects nothing instead of reaching alasql
    return `(SELECT * FROM \`${tableName}\` WHERE ${hasInlineJs(filter) ? "1 = 0" : filter}) AS __src`;
  }
  return `\`${tableName}\``;
}

/**
 * True when `name` is registered as a table or a view. A query on a name that
 * is not registered yet means "no data so far". A failing query on a
 * registered name is an error.
 */
export function isRegistered(db: AlaSQLDatabase, name: string): boolean {
  // alasql keeps a view in db.tables as well
  return db.tables?.[name] != null;
}

/** {@link buildFromExpr} for a registered source, `""` otherwise. The query helpers read `""` as "no data". */
export function sourceExpr(db: AlaSQLDatabase, tableName: string, filter?: string | null): string {
  return tableName && isRegistered(db, tableName) ? buildFromExpr(tableName, filter) : "";
}

/**
 * True when alasql would find a double backtick in `sql`: it runs the text
 * between double backticks as JavaScript. alasql strips comments before it
 * reads the text, so two backticks with only a comment between them count too.
 */
export function hasInlineJs(sql?: string | null): boolean {
  if (!sql) return false;
  // @ts-ignore - utils is not in the public typings
  const uncommented: string = alasql.utils?.uncomment?.(sql) ?? "";
  return sql.includes("``") || uncommented.includes("``");
}

/** Pub/sub-enabled wrapper around an isolated alasql database. */
export interface ScopedDb {
  /** The underlying alasql database. Use it directly for `db.exec(...)` queries. */
  readonly db: AlaSQLDatabase;

  /** Register a callback fired synchronously whenever `notify(name)` is called. Returns the unsubscribe function. */
  subscribe(name: string, cb: () => void): () => void;

  /** Fire all subscribers registered for `name`. Producers call this after writing data. */
  notify(name: string): void;

  /** True if a table with this name exists in the database. */
  hasTable(name: string): boolean;

  /** True if a view with this name exists in the database. */
  hasView(name: string): boolean;

  /**
   * Announces a producer of `name` (a dataset or a datasource element). `onShared`
   * tells every producer of the name whether another one holds it too: they would
   * overwrite each other's data. Returns the release function.
   */
  claim(name: string, onShared: (shared: boolean) => void): () => void;
}

/** Coerces an unknown value into a Luxon `DateTime`, or `undefined` if it can't be parsed. */
function toDateTime(value: unknown): DateTime | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const dt = DateTime.fromISO(value, { zone: "utc" });
    return dt.isValid ? dt : undefined;
  }
  if (typeof value === "number") {
    const dt = DateTime.fromMillis(value, { zone: "utc" });
    return dt.isValid ? dt : undefined;
  }
  // Already a DateTime-shaped object.
  if (typeof (value as { isValid?: boolean }).isValid === "boolean") {
    const dt = value as DateTime;
    return dt.isValid ? dt : undefined;
  }
  return undefined;
}

/**
 * AlaSQL custom functions (UDFs) live on the `alasql.fn` global, not per-DB.
 * Register them once at module load - multiple contexts share the registrations.
 *
 * Signatures are widened to `(...x: unknown[]) => unknown` to satisfy alasql's
 * `userDefinedFunction` type; argument validation happens inside each UDF.
 */
let udfsRegistered = false;
function registerUdfs(): void {
  if (udfsRegistered) return;
  udfsRegistered = true;

  alasql.fn.transformOperator = ((a: unknown): number => (a === "-" ? -1 : 1)) as (...x: unknown[]) => unknown;

  alasql.fn.normalizeDate = ((date: unknown, normalizationLevel: unknown, _locale?: unknown): DateTime | undefined => {
    const dt = toDateTime(date);
    if (!dt) return undefined;
    return dt.startOf(normalizationLevel as Parameters<DateTime["startOf"]>[0]);
  }) as (...x: unknown[]) => unknown;

  // Custom aggregate collecting unique values per group, used by bn-table attribute
  // expressions like set(_leiter). alasql stages: 1 = init, 2 = accumulate, 3 = finalize.
  alasql.aggr.SETAGG = (value: unknown, accumulator: unknown, stage: number): unknown => {
    if (stage === 1) {
      return value == null ? [] : [value];
    }
    const acc = accumulator as unknown[];
    if (stage === 2) {
      if (value != null && !acc.includes(value)) acc.push(value);
      return acc;
    }
    return acc.join(", ");
  };
}

/** Creates a fresh isolated database with its own subscriber map. */
export function createScopedDb(): ScopedDb {
  registerUdfs();

  const db = new alasql.Database();
  const subscribers = new Map<string, Set<() => void>>();
  const claims = new Map<string, Set<(shared: boolean) => void>>();

  return {
    db,

    subscribe(name: string, cb: () => void): () => void {
      let set = subscribers.get(name);
      if (!set) {
        set = new Set();
        subscribers.set(name, set);
      }
      set.add(cb);
      return () => {
        const s = subscribers.get(name);
        if (!s) return;
        s.delete(cb);
        if (s.size === 0) subscribers.delete(name);
      };
    },

    notify(name: string): void {
      const set = subscribers.get(name);
      if (!set) return;
      for (const cb of set) {
        try {
          cb();
        } catch (e) {
          console.error(`[bn] subscriber for "${name}" threw`, e);
        }
      }
    },

    hasTable(name: string): boolean {
      return db.tables?.[name] != null;
    },

    hasView(name: string): boolean {
      // alasql stores views in db.views (separate from db.tables)
      // @ts-ignore - views is not in the public typings
      return db.views?.[name] != null;
    },

    claim(name: string, onShared: (shared: boolean) => void): () => void {
      const producers = claims.get(name) ?? new Set();
      claims.set(name, producers);
      producers.add(onShared);
      const tell = () => producers.forEach((cb) => cb(producers.size > 1));
      tell();
      return () => {
        producers.delete(onShared);
        if (producers.size === 0) claims.delete(name);
        tell();
      };
    },
  };
}
