import { SYSTEM_STYLE_DEFAULTS } from "../../stores/componentStyles";
import { readDiagnostics } from "./diagnostics";
import { Origins, measure } from "./geometry";
import { resolveStandaloneId } from "./identity";
import { ComponentLayoutState, LAYOUT_STATE_VERSION } from "./types";

/**
 * Effective font size of an element in px, resolved from computed style
 * (which reflects `--bn-font-size` scaling). Falls back to the system
 * default where computed style is unavailable (spec tests).
 */
export function readFontSizePx(el: HTMLElement): number {
  if (typeof getComputedStyle === "function") {
    const parsed = parseFloat(getComputedStyle(el).fontSize);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return SYSTEM_STYLE_DEFAULTS.global.fontSizePx;
}

/**
 * Layout state for a visual component without its own `getLayoutState()`:
 * host box, identity, em context and diagnostics - no regions or elements.
 * The caller (`bn-context`) overwrites `id` with its document-order identity.
 */
export function buildGenericState(el: HTMLElement, origins: Origins): ComponentLayoutState {
  return {
    version: LAYOUT_STATE_VERSION,
    tag: el.localName,
    id: resolveStandaloneId(el),
    slot: el.getAttribute("slot") ?? undefined,
    rect: measure(el, origins),
    em: { fontSizePx: readFontSizePx(el), appliedScaleFactor: 1 },
    regions: [],
    metadata: {},
    diagnostics: readDiagnostics(el),
  };
}
