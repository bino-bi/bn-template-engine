import { TimeChartStyle } from "../components/bn-chart-time/utils/model";
import { BinoChartSyles, QueryColumnNames, VarianceScenario } from "./model";

import CalculateSize from "calculate-size";

/**
 * Number and label formatting utilities following ISO 80000-1 conventions.
 */
export class Formatter {
  /** Replacement character for the thousands group separator (default de-DE uses period). */
  private static tsdDelimiter: string = ".";
  /** Replacement character for the decimal separator (default de-DE uses comma). */
  private static postfixSeperator: string = ",";

  /**
   * Formats a number for display following ISO 80000-1 conventions.
   *
   * Pipeline: divide by scale factor -> format via de-DE locale -> strip whitespace
   * before `%` -> replace group separator with `postfixSeperator` -> replace decimal
   * separator with `tsdDelimiter`.
   *
   * @param scale Divisor applied before formatting (e.g. 1000 for "k" SI prefix).
   */
  static number(value: number, type: string = "decimal", digits: number = 1, digitsMin: number = 0, scale = 1) {
    const scaledValue = value / scale;

    return scaledValue
      .toLocaleString("de-DE", {
        style: type as Intl.NumberFormatOptions["style"],
        useGrouping: true,
        maximumFractionDigits: digits,
        minimumFractionDigits: digitsMin,
      })
      .replace(/\s+(%)/g, "$1")
      .replace(/\s/g, this.postfixSeperator)
      .replace(/\./g, this.tsdDelimiter);
  }

  /**
   * Translates a technical scenario identifier into a human-readable IBCS label.
   *
   * Uses IBCS symbol conventions from the i18n map:
   * - AC-base absolute variance: `ibcssymbol_delta_ac` -- renders as e.g. `Delta{scenarioName}`
   * - AC-base relative variance: `ibcssymbol_delta_ac_relative` -- renders as e.g. `Delta(scenarioName)`
   * - Non-AC absolute variance: `ibcssymbol_delta_generic`
   * - Non-AC relative variance: `ibcssymbol_delta_generic_relative`
   *
   * The `{%}` placeholder in the i18n token is replaced with the translated scenario name(s).
   * Non-variance scenarios are looked up directly in the i18n map.
   */
  static translateScenarioLabel(scenario: string | undefined, i18n: Map<string | number, string>): string {
    if (scenario === null || scenario === undefined) {
      return "";
    }

    const scenarios: VarianceScenario = new VarianceScenario(scenario);

    if (!scenarios.isValid) {
      return `${i18n.get(scenario) || scenario}`;
    }

    let token;
    let scenarioLabel;

    if (QueryColumnNames.AC1 === scenarios.base) {
      if (scenarios.type === "dr") {
        token = i18n.get("ibcssymbol_delta_ac" + "_relative");
      } else {
        token = i18n.get("ibcssymbol_delta_ac" + "");
      }
      scenarioLabel = i18n.get(scenarios.delta) || scenarios.delta;
    } else {
      if (scenarios.type === "dr") {
        token = i18n.get("ibcssymbol_delta_generic" + "_relative");
      } else {
        token = i18n.get("ibcssymbol_delta_generic" + "");
      }
      scenarioLabel = `${i18n.get(scenarios.base) || scenarios.base} - ${i18n.get(scenarios.delta) || scenarios.delta}`;
    }

    if (token === undefined) {
      token = "{%}";
    }

    return `${token.replace("{%}", scenarioLabel)}`;
  }

  // FIXME JHE: querverweis  TimeChartSTyle muss raus
  static getMaxWidthOfArrayItems(
    scenarios: string[],
    i18n: Map<string, string>,
    style: BinoChartSyles | TimeChartStyle,
  ) {
    return CalculateSize(
      scenarios
        .map((scenario) => Formatter.translateScenarioLabel(scenario, i18n))
        .reduce((a, b) => (a.length < b.length ? b : a), ""),
      {
        font: style.fontStyles.font,
        fontSize: style.fontStyles.size + "px",
      },
    ).width;
  }
}
