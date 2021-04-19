import {
  DataFormat,
  DateDistance,
  DateLink,
  OrderColumn,
  OrderDirection,
  Scenarios,
  Sentiments,
  TableType,

} from "@bino-bi/ibcs-component-interface";

export function isBlankInput(value: any): boolean {
  return value === null || value === undefined || value === '';
}


export function validateScenarioList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  const invalidScenarios: string[] = value?.split(',')
    .filter(element => !(element.toUpperCase() in Scenarios));

  return validateVariancesList(invalidScenarios.toString());
}


export function validateVariancesList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  let invalidScenarios: string[] = value.split(',')
    .filter(element => {
      const splittedElement = element.split('_');

      const scenarioSubtrahend = splittedElement[0]?.replace(/^dr|^d/, "").toUpperCase()
      const scenarioMinuend = splittedElement[1]?.toUpperCase();
      const scenarioSentiment = splittedElement[2]?.toUpperCase();

      return splittedElement.length != 3 || !(scenarioSubtrahend in Scenarios) || !(scenarioMinuend in Scenarios) || !(scenarioSentiment in Sentiments)
    });

  return invalidScenarios;
}


export function validateOrderList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  let invalidScenarios: string[] = value.split(',').filter(element => !(element.toUpperCase() in OrderColumn));

  return validateVariancesList(invalidScenarios.toString());

}


export function isValidInteger(value: number | string): boolean {
  if (isBlankInput(value)) {
    return false;
  }

  return Number.isInteger(Number(value));
}


export function isValidDirection(value: string): boolean {
  return value?.toUpperCase() in OrderDirection;
}


export function validateMeasureList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array) {
      return newObj.filter(elem => !(elem.hasOwnProperty('name') && elem.hasOwnProperty('unit')));
    }
  } catch {
  }

  return ["Invalid JSON structure"]
}


export function isValidDate(value: any): boolean {
  const newDate: number = Date.parse(value);
  return Number.isInteger(newDate);
}


export function isValidDateLink(value: string): boolean {
  return value?.toUpperCase() in DateLink;
}


export function isValidDateFormat(value: string): boolean {
  return value?.toUpperCase() in DateDistance;
}


export function isValidDataFormat(value: string): boolean {
  if (isBlankInput(value)) {
    return false
  }
  return value?.toUpperCase() in DataFormat;
}


export function isValidBoolean(value: any): boolean {
  if (isBlankInput(value)) {
    return false
  }

  const validValues: any[] = ["true", "false", true, false];
  return validValues.some(elem => elem == value);
}

export function isValidTableType(value: any): boolean {
  if (isBlankInput(value)) {
    return false
  }

  return value?.toUpperCase() in TableType;
}


export function validateThereOfJsonStr(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array) {
      // return newObj.filter(elem => elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category') && elem.hasOwnProperty('subcategory'))
      return newObj.filter(elem => !(elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category') && elem.hasOwnProperty('subcategory')));

    }
  } catch {
  }
  return ["Invalid JSON structure"]
}


export function isValidi18nMode(value: string): boolean {
  console.log(value)
  return true; //value?.toUpperCase() in I18nMode;
}





