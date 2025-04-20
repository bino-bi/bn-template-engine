import { TimeChartStyle } from "../components/bn-chart-time/utils/model";
import {BinoChartSyles, QueryColumnNames, VarianceScenario} from "./model";

import CalculateSize from "calculate-size";

export class Formatter {
  // implements ISO 80000-1
  // private decimalSeparator = ',';
  private static tsdDelimiter: string = '.';
  private static postfixSeperator: string = ',';

  static number(value: number, type: string = 'decimal', digits: number = 1, digitsMin: number = 0, scale = 1) {
    // replace used as workaround to implement ISO 80000-1
    let scaledValue = value / scale;
        
    return scaledValue.toLocaleString('de-DE', {
      style: type as Intl.NumberFormatOptions['style'],
      useGrouping: true,
      maximumFractionDigits: digits,
      minimumFractionDigits: digitsMin
    }).replace(/\s/g, this.postfixSeperator).replace(/\./g, this.tsdDelimiter);
  }

  static translateScenarioLabel(scenario: string | undefined, i18n: Map<string | number, string>): string {

    if (scenario === null || scenario === undefined ) {
      return "";
    }

    let scenarios: VarianceScenario = new VarianceScenario(scenario);

    if (!scenarios.isValid) {
      return `${i18n.get(scenario) || scenario}`;
    }

    let token;
    let scenarioLabel;

    if (QueryColumnNames.AC1 == scenarios.base) {
        if (scenarios.type == "dr") {
          token = i18n.get("ibcssymbol_delta_ac" + '_relative');
        } else {
          token = i18n.get("ibcssymbol_delta_ac" + '');
        }
        scenarioLabel = i18n.get(scenarios.delta) || scenarios.delta;
    } else {
      if (scenarios.type == "dr") {
        token = i18n.get("ibcssymbol_delta_generic" + '_relative');
      } else {
        token = i18n.get("ibcssymbol_delta_generic" + '');
      }
      scenarioLabel = `${i18n.get(scenarios.base) || scenarios.base} - ${i18n.get(scenarios.delta) || scenarios.delta}`;
    }

    if (token === undefined) {
      token = '{%}';
    }

    return `${token.replace("{%}", scenarioLabel)}`;

  }

  // FIXME JHE: querverweis  TimeChartSTyle muss raus
  static getMaxWidthOfArrayItems(scenarios: string[], i18n: Map<string, string>, style: BinoChartSyles | TimeChartStyle) {
    return CalculateSize(scenarios.map((scenario) => Formatter.translateScenarioLabel(scenario, i18n))
      .reduce((a, b) => a.length < b.length ? b : a, ""), {
      font: style.fontStyles.font,
      fontSize: style.fontStyles.size + "px"
    }).width;
  }

}
