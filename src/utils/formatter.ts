import { BinoChartSyles, QueryColumnNames, VarianceScenario } from "./model";

import CalculateSize from "calculate-size";

/**
 * Number and label formatting utilities following ISO 80000-1 conventions.
 */
export class Formatter {
  /** One formatter per locale, style and digits: building one per cell is slow. */
  private static formats = new Map<string, Intl.NumberFormat>();

  /**
   * Replaces the group separator of the locale in every number, for example by a thin
   * space. Null: the separator of the locale. One setting for the page: `bn-context` sets it.
   */
  static groupSeparator: string | null = null;

  /**
   * Formats a number for display in the given locale.
   *
   * Pipeline: divide by scale factor -> format via `Intl.NumberFormat` for the locale ->
   * strip whitespace before `%`. A value that rounds to zero is never printed with a minus sign.
   *
   * @param scale Divisor applied before formatting (e.g. 1000 for "k" SI prefix).
   * @param locale BCP 47 tag (e.g. `de`, `en`, `de-CH`). An unknown or malformed tag falls back to `de-DE`.
   */
  static number(
    value: number,
    type: string = "decimal",
    digits: number = 1,
    digitsMin: number = 0,
    scale = 1,
    locale: string = "de",
  ) {
    const key = `${locale}|${type}|${digits}|${digitsMin}`;
    let format = this.formats.get(key);

    if (!format) {
      const options = {
        style: type as Intl.NumberFormatOptions["style"],
        useGrouping: true,
        maximumFractionDigits: digits,
        minimumFractionDigits: digitsMin,
      };

      try {
        // a tag the runtime does not know resolves to de-DE, not to the locale of the machine
        format = new Intl.NumberFormat([locale, "de-DE"], options);
      } catch (_e) {
        // malformed tag
        format = new Intl.NumberFormat("de-DE", options);
      }

      this.formats.set(key, format);
    }

    const print = (number: number): string =>
      this.groupSeparator === null
        ? format.format(number)
        : format
            .formatToParts(number)
            .map((part) => (part.type === "group" ? (this.groupSeparator as string) : part.value))
            .join("");
    const text = print(value / scale);

    // a small negative that rounds to zero would print "-0"
    return (text === print(-0) ? print(0) : text).replace(/\s+(%)/g, "$1");
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

  static getMaxWidthOfArrayItems(
    scenarios: string[],
    i18n: Map<string, string>,
    style: Pick<BinoChartSyles, "fontStyles">,
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
