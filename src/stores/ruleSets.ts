/**
 * Reactive store for user-adjustable IBCS visualization rule sets.
 *
 * Rule sets are resolved through a three-layer merge:
 * 1. `_system` -- built-in IBCS defaults (scenario names, color and sort indices)
 * 2. `_default` -- optional user-level overrides applied globally
 * 3. Named rule sets -- overrides referenced by the `ruleset` attribute
 *
 * The `withRuleSet` mixin merges these layers and the resulting config seeds
 * `IBCSRuleSet`, which expands each scenario prefix to its 1-4 variants.
 *
 * @module stores/ruleSets
 */

/** Per-scenario-prefix rule overrides. Variants 1-4 are derived from the base values. */
export interface ScenarioRuleConfig {
  /**
   * Display name. Slot 1 shows it as is, the slots 2 to 4 with their number
   * ("Budget", "Budget2"). A name that a `<bn-ruleset>` sets replaces the
   * i18n labels `global.<prefix>1` to `global.<prefix>4`. The built-in names
   * do not.
   */
  name?: string;
  /**
   * Selects the theme style slot the scenario is drawn in: 10 = `ac` (solid),
   * 20 = `pp` (light), 30 = `fc` (hatched), 50 = `pl` (outlined). Any other
   * value counts as 10.
   */
  colorIndex?: number;
  /** Base sort index for column ordering; variant n adds n*10. */
  sortIndex?: number;
}

/** Serializable rule-set configuration written by `<bn-ruleset>` and consumed by `IBCSRuleSet`. */
export interface RuleSetConfig {
  /**
   * Keyed by scenario prefix. Data columns exist for `ac`, `pp`, `fc` and `pl`.
   * Of the variance prefixes (`dac`, `drac`, ...) only `sortIndex` is read.
   */
  scenarios?: Record<string, ScenarioRuleConfig>;
  /** Style returned for scenario names not present in `scenarios`. */
  fallback?: {
    name?: string;
    group?: string;
    colorIndex?: number;
    sortIndex?: number;
  };
}

/**
 * Built-in IBCS rule-set defaults per IBCS notation standard v1.2.
 * Sort order: PP(100s) < PL(200s) < FC(300s) < AC(400s); variance prefixes
 * add +1000 (absolute) or +1005 (relative), so a relative variance sorts
 * directly after the absolute variance with the same reference.
 */
export const SYSTEM_RULESET_DEFAULTS: RuleSetConfig = {
  scenarios: {
    ac: { name: "AC", colorIndex: 10, sortIndex: 400 },
    fc: { name: "FC", colorIndex: 30, sortIndex: 300 },
    pl: { name: "PL", colorIndex: 50, sortIndex: 200 },
    bu: { name: "BU", colorIndex: 50, sortIndex: 200 },
    pp: { name: "PP", colorIndex: 20, sortIndex: 100 },
    py: { name: "PY", colorIndex: 20, sortIndex: 100 },

    dac: { name: "dAC", colorIndex: 10, sortIndex: 1400 },
    dfc: { name: "dFC", colorIndex: 30, sortIndex: 1300 },
    dpl: { name: "dPL", colorIndex: 50, sortIndex: 1200 },
    dbu: { name: "dBU", colorIndex: 50, sortIndex: 1200 },
    dpp: { name: "dPP", colorIndex: 20, sortIndex: 1100 },
    dpy: { name: "dPY", colorIndex: 20, sortIndex: 1100 },

    drac: { name: "drAC", colorIndex: 10, sortIndex: 1405 },
    drfc: { name: "drFC", colorIndex: 30, sortIndex: 1305 },
    drpl: { name: "drPL", colorIndex: 50, sortIndex: 1205 },
    drbu: { name: "drBU", colorIndex: 50, sortIndex: 1205 },
    drpp: { name: "drPP", colorIndex: 20, sortIndex: 1105 },
    drpy: { name: "drPY", colorIndex: 20, sortIndex: 1105 },
  },
  fallback: {
    name: "Series",
    group: "Series",
    colorIndex: 10,
    sortIndex: 120,
  },
};
