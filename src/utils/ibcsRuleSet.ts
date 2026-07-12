import { merge } from "@corex/deepmerge";
import { ScenarioStyle, VisualisationRuleSet } from "../components/bn-table/utils/model";
import { RuleSetConfig, SYSTEM_RULESET_DEFAULTS } from "../stores/ruleSets";
import { VarianceScenario } from "./model/VarianceScenario";

/**
 * IBCS rule set defining scenario→style mappings per IBCS notation standard v1.2.
 *
 * Color indices encode IBCS visual encoding:
 * - 10 = AC: solid dark fill
 * - 20 = PP: light gray fill
 * - 30 = FC: hatched pattern fill
 * - 50 = PL: outlined (no fill)
 *
 * Sort indices determine column display order: PP(100s) < PL(200s) < FC(300s) < AC(400s).
 * Variance columns add +1000 (absolute) or +2000 (relative) to the base sort index.
 * Within each group, variant number (1-4) adds multiples of 10.
 *
 * The built-in rules live in `SYSTEM_RULESET_DEFAULTS` (stores/ruleSets); an
 * optional partial {@link RuleSetConfig} passed to the constructor is
 * deep-merged over them, so `new IBCSRuleSet()` keeps the standard behavior.
 */
export class IBCSRuleSet implements VisualisationRuleSet {
  public readonly _dateFormat = {
    year: "YYYY",
    quarter: "Q[Q] YYYY",
    month: "MMM YYYY",
    locale: "[KW]WW YYYY",
    day: "DD.MM.YYYY",
  };
  public readonly _dateLinkFormat = {
    avg: "Ø[DATE]",
    interval: "[DATE]..[DATE]",
    start: ".[DATE]",
    end: "[DATE].",
    ytd: "_[DATE]",
    ytg: "[DATE]_",
    cum: "[DATE]_[DATE]",
    mat: "~[DATE]",
    none: "[DATE]",
  };
  private _scenarioMap: Map<string, ScenarioStyle> = new Map<string, ScenarioStyle>();
  private readonly _fallBackScenario: ScenarioStyle;

  constructor(config?: RuleSetConfig) {
    // defines scenario sortIndex an colour   PP, PL, FC, AC,
    const effective = merge([SYSTEM_RULESET_DEFAULTS, config ?? {}]) as RuleSetConfig;

    Object.entries(effective.scenarios).forEach(([key, scenario]) => {
      this.createScenarioMapEntry(key, scenario.name ?? key, scenario.colorIndex ?? 10, scenario.sortIndex ?? 0);
    });

    this._fallBackScenario = effective.fallback as ScenarioStyle;
  }

  private createScenarioMapEntry(key: string, name: string, colorIndex: number, sortIndex: number) {
    const range = [1, 2, 3, 4];

    const _group = name;
    const _colorIndex = colorIndex;

    range.forEach((element) => {
      const _key = key + element;
      const _name = name + element;
      const _sortIndex = sortIndex + element * 10;

      this._scenarioMap.set(_key, { name: _name, group: _group, colorIndex: _colorIndex, sortIndex: _sortIndex });
    });
  }

  getScenario(scenarioName: string): ScenarioStyle {
    if (this._scenarioMap.has(scenarioName)) {
      return this._scenarioMap.get(scenarioName)!;
    } else {
      return this._fallBackScenario;
    }
  }

  getScenarioGroup(scenarioName: string): string {
    if (this._scenarioMap.has(scenarioName)) {
      return this._scenarioMap.get(scenarioName)!.name;
    } else {
      return this._fallBackScenario.name;
    }
  }

  getScenarioColorIndex(scenarioName: string): number {
    if (this._scenarioMap.has(scenarioName)) {
      return this._scenarioMap.get(scenarioName)!.colorIndex;
    } else {
      return this._fallBackScenario.colorIndex;
    }
  }

  getScenarioSorIndex(scenarioName: string): number {
    const normalizedScenario = this.normalizeVarianceScenario(scenarioName);
    if (this._scenarioMap.has(normalizedScenario)) {
      return this._scenarioMap.get(normalizedScenario)!.sortIndex;
    } else {
      return this._fallBackScenario.sortIndex;
    }
  }

  /**
   * Strips the base scenario from a variance column name, returning type+delta for sort index lookup.
   * Example: `"dac1_pl1_pos"` → `"dpl1"`, `"drac1_pl1_neg"` → `"drpl1"`
   */
  normalizeVarianceScenario(scenario: string | undefined): string {
    if (scenario === null || scenario === undefined) {
      return "";
    }

    const scenarios: VarianceScenario = new VarianceScenario(scenario);

    if (!scenarios.isValid) {
      return scenario;
    }

    return scenarios.type + scenarios.delta;
  }
}
