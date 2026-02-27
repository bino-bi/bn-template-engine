//import {VisualisationRuleSet, Scenario} from "../components/ibcs-table/utils/model";
import { Scenario, VisualisationRuleSet } from "../components/bn-table/utils/model"; // TODO JHE: Scenario Dublicate
import { VarianceScenario } from "./model/VarianceScenario";

/**
 * Ruleset defines styles and formats used for IBCS-Charts
 * Implements IBVS 1.2
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
  private _scenarioMap: Map<string, Scenario> = new Map<string, Scenario>();
  private readonly _fallBackScenario: Scenario = { name: "Series", group: "Series", colorIndex: 10, sortIndex: 120 };

  constructor() {
    // defines scenario sortIndex an colour   PP, PL, FC, AC,

    this.createScenarioMapEntry("ac", "AC", 10, 400);
    this.createScenarioMapEntry("fc", "FC", 30, 300);
    this.createScenarioMapEntry("pl", "PL", 50, 200);
    this.createScenarioMapEntry("bu", "BU", 50, 200);
    this.createScenarioMapEntry("pp", "PP", 20, 100);
    this.createScenarioMapEntry("py", "PY", 20, 100);

    this.createScenarioMapEntry("dac", "dAC", 10, 1400);
    this.createScenarioMapEntry("dfc", "dFC", 30, 1300);
    this.createScenarioMapEntry("dpl", "dPL", 50, 1200);
    this.createScenarioMapEntry("dbu", "dBU", 50, 1200);
    this.createScenarioMapEntry("dpp", "dPP", 20, 1100);
    this.createScenarioMapEntry("dpy", "dPY", 20, 1100);

    this.createScenarioMapEntry("drac", "drAC", 10, 2400);
    this.createScenarioMapEntry("drfc", "drFC", 30, 2300);
    this.createScenarioMapEntry("drpl", "drPL", 50, 2200);
    this.createScenarioMapEntry("drbu", "drBU", 50, 2200);
    this.createScenarioMapEntry("drpp", "drPP", 20, 2100);
    this.createScenarioMapEntry("drpy", "drPY", 20, 2100);
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

  getScenario(scenarioName: string): Scenario {
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
