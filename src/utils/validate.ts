import {
  OrderColumn,
  Scenarios,
  Sentiments,
  OrderDirection,
  DateDistance,
  DateLink
} from "@bino-bi/ibcs-component-interface";

export function isBlankInput(value: any): boolean {
    return value === null || value === undefined || value === '';
}


export function validateScenarioList(value: string): string[] {
    if(isBlankInput(value)){
      return [];
    }

    const invalidScenarios: string[] = value?.split(',')
                                           .filter(element => !(element.toUpperCase() in Scenarios));

    return validateVariancesList(invalidScenarios.toString());
}


export function validateVariancesList(value: string): string[] {
  if(isBlankInput(value)){
    return [];
  }

  let invalidScenarios: string[] = value.split(',')
                                        .filter(element => {
                                          const splittedElement = element.split('_');

                                          const scenarioSubtrahend = splittedElement[0]?.replace(/^dr|^d/, "").toUpperCase()
                                          const scenarioMinuend    = splittedElement[1]?.toUpperCase();
                                          const scenarioSentiment  = splittedElement[2]?.toUpperCase();

                                          return splittedElement.length != 3 || !(scenarioSubtrahend in Scenarios) || !(scenarioMinuend in Scenarios) || !(scenarioSentiment in Sentiments)
                                        });

  return invalidScenarios;
}


export function validateOrderList(value: string): string[] {
  if(isBlankInput(value)){
    return [];
  }

  let invalidScenarios: string[] = value.split(',').filter(element => !(element.toUpperCase() in OrderColumn));

  return validateVariancesList(invalidScenarios.toString());;
}


export function isValidDirection(value: string): boolean {
  return value?.toUpperCase() in OrderDirection;
}


export function validateMeasureList(value: string): string[] {
  if(isBlankInput(value)){
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if(newObj instanceof Array){
      return newObj.filter(elem => !(elem.hasOwnProperty('name') && elem.hasOwnProperty('unit')));
    }
  } catch{}

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


export function validateScenarioUnitType(value: string): string [] {
  let result: string[] = [];
  let supportedScenarioTypes: string[] = ['decimal', 'percent'];

  if(!isBlankInput(value)){
    result = value.split(',').filter(element => !supportedScenarioTypes.includes(element));
  }

  return result
}










export function isValidBoolean(value: any): boolean {
    const validValues: any[] =["true" , "false", true, false];
    return validValues.some( elem => elem == value);
}

export function isValidTableType(value: any): boolean {
    const validValues: string[] =["list" , "sum", "opt","optnototal"];
    return validValues.some( elem => elem === value);
}

export function isValidThereOf(value: any): boolean {

    const newObj = JSON.parse(value);
    if(newObj instanceof Array){
       return newObj.every(elem => elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category')&& elem.hasOwnProperty('subcategory'))
    }
    else {
        return false;
    }

}


export function isValidi18nMode(value: any): boolean {
    const validValues: string[] =["none" , "all", "meta"];
    return validValues.some( elem => elem === value);
}





