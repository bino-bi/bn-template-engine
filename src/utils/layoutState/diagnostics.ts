import { LayoutDiagnosticItem } from "./types";

/**
 * Reads a component's diagnostics from the `has-error` attribute that
 * `withHasError` maintains (JSON-serialized `ErrorItem[]`). Returns an empty
 * list for a missing or malformed attribute.
 */
export function readDiagnostics(el: HTMLElement): LayoutDiagnosticItem[] {
  const raw = el.getAttribute("has-error");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
