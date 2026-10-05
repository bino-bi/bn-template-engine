import { ErrorDispatcher } from "./withHasError";

/** The text of a caught exception. */
export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Sets the `ERR_sql` item of a visual from the text of a failed query, or removes it when there is none. */
export const reportQueryError = (errors: ErrorDispatcher | undefined, message: string | undefined) => {
  if (message === undefined) {
    errors?.remove("ERR_sql");
  } else {
    errors?.addOrReplace({ id: "ERR_sql", type: "error", message: `Query failed: ${message}` });
  }
};
