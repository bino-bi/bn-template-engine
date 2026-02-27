import { I18nMode } from "../../../../../utils/constants";
import { DateStringFactory } from "../../../../../utils/DateStringFactory";
import { Formatter } from "../../../../../utils/formatter";
import { Order } from "../../../../../utils/model/Order";
import { MeasureEntry } from "../model/MeasureEntriy";
import { TimePeriod } from "../model/TimePeriod";

// FIXME IOrder

export class TitleDataSetFactory implements Formatter {
  constructor() {}

  /**
   * Creates  measures, adds i18n to each element
   * @param measures
   * @param i18n
   * @param i18nMode
   */
  createMeasures(measures: MeasureEntry[], i18n: Map<string, string>, i18nMode: I18nMode): MeasureEntry[] {
    if (this.allMeasuresUseSameUnit(measures)) {
      const amountOfMeasures: number = measures.length;
      let measureName: string = "";
      let unit: string = "";

      for (let i = 0; i < amountOfMeasures; i++) {
        let separator: string | undefined = "";
        if (i > 0) {
          separator = i18n.get("SEPERATOR_WS");
        }
        if (amountOfMeasures > 1 && i === amountOfMeasures - 1) {
          separator = i18n.get("CONNECTOR_WS");
        }

        if (i18nMode == I18nMode.ALL) {
          measureName =
            (i18n.get(measureName) || measureName) + separator + (i18n.get(measures[i].name) || measures[i].name);
          unit = i18n.get(measures[i].unit as string) || (measures[i].unit as string);
        } else {
          measureName = measureName + separator + measures[i].name;
          unit = measures[i].unit as string;
        }
      }

      return [
        {
          name: measureName,
          unit: unit,
        },
      ];
    } else {
      return measures as MeasureEntry[];
    }
  }

  /**
   * Creates Dimension String,
   * concat of translated scenarios, time and order
   *
   * @param scenarios
   * @param time
   * @param order
   * @param i18n
   */
  public createDimension(
    scenarios: string[],
    time: TimePeriod | undefined,
    order: Order | null | undefined,
    i18n: Map<string, string>,
    spanLimit: number,
  ): string {
    let formatedTime: string = "";

    if (time != undefined) {
      formatedTime = new DateStringFactory().getDateLinkString(time.start, time.end, time.link, time.format, spanLimit);
    }

    const formatedScenarios: string = scenarios
      .map((scenario) => {
        let orderString: string | undefined = "";
        if (order != null && order.hierarchy != null) {
          if (order.hierarchy.find((x) => x === scenario)) {
            if (order.direction == "asc") {
              orderString = i18n.get("ORDER_asc");
            } else {
              orderString = i18n.get("ORDER_desc");
            }
          }
        }
        return "".concat(" ", Formatter.translateScenarioLabel(scenario, i18n), <string>orderString);
      })
      .toString();

    return formatedTime + formatedScenarios;
  }

  private allMeasuresUseSameUnit(measures: MeasureEntry[]) {
    const units: Map<string, boolean> = new Map();
    measures.forEach(function (entry) {
      units.set(entry.unit as string, true);
    });

    const hasOneUnit = units.size == 1;
    return hasOneUnit;
  }
}
