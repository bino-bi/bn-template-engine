import { AggregationLevel, AxisLabelsMode, DataFormat, I18nMode, MeasureType, Scenarios, Sentiments, TableCategoryWidth, TableType } from "./constants";
import { DateDistance, DateLink } from "./DateStringFactory";
import { OrderColumn, OrderDirection } from "./model/Order";

/*import {
  AggregationLevel, AxisLabelsMode,
  DataFormat,
  DateDistance,
  DateLink, I18nMode, MeasureType,
  OrderColumn,
  OrderDirection,
  Scenarios,
  Sentiments, TableCategoryWidth,
  TableType,

} from "@bino-bi/ibcs-component-interface";
*/
export function isBlankInput(value: any): boolean {
  return value === null || value === undefined || value === '' || value =='null';
}


export function validateScenarioList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  if (value.trim().toLowerCase() === 'auto') {
    return [];
  }

  const invalidScenarios: string[] = value?.split(',')
    .filter(element => !(element.toUpperCase().trim() in Scenarios));

  return validateVariancesList(invalidScenarios.toString());
}


export function validateVariancesList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  let invalidScenarios: string[] = value.replace(';', ',').split(',').filter(element => {
      const splittedElement = element.split('_');

      const scenarioSubtrahend = splittedElement[0]?.replace(/^dr|^d/, "").toUpperCase().trim();
      const scenarioMinuend = splittedElement[1]?.toUpperCase().trim();
      const scenarioSentiment = splittedElement[2]?.toUpperCase().trim();

      return splittedElement.length != 3 || !(scenarioSubtrahend in Scenarios) || !(scenarioMinuend in Scenarios) || !(scenarioSentiment in Sentiments)
    });

  return invalidScenarios;
}


export function validateOrderList(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  if (value.trim().toLowerCase() === 'auto') {
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

export function isValidNumber(value: number | string): boolean {
  if (isBlankInput(value)) {
    return false;
  }

  return !Number.isNaN(Number(value));
}

export function isValidDirection(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }

  return value?.toUpperCase() in OrderDirection;
}

export function isValidLevel(value: string): boolean {
  if (value?.toLowerCase() === 'auto') {
    return true;
  }
  return value?.toUpperCase() in AggregationLevel;
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
  } catch (e) {
    console.error("validateMeasureList: failed to parse JSON", e);
  }

  return ["Invalid JSON structure"]
}

export function validateMarkerType(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array) {
       return newObj.filter(elem =>  !elem.hasOwnProperty('latitude')
                                 && !elem.hasOwnProperty('longitude')
                                 && !elem.hasOwnProperty('iconUrl'));
    }
  } catch(e) {
    throw e;
  }

  return ["Invalid JSON structure"]
}

export function validateGpxType(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array){
      return newObj.filter(elem => !(elem.hasOwnProperty('file')));
    }
  } catch(e) {
    throw e;
  }

  return ["Invalid JSON structure"]
}

export function validateGeojsonType(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const newObj = JSON.parse(value);
    if (newObj instanceof Array){
      return newObj.filter(elem => !(elem.hasOwnProperty('file')));
    }
  } catch(e) {
    throw e;
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

export function isValidAxisLabelsMode(value: string): boolean {
  return value?.toUpperCase() in AxisLabelsMode;
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
    const jsonObject = JSON.parse(value);
    if (jsonObject instanceof Array) {
     
      // return newObj.filter(elem => elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category') && elem.hasOwnProperty('subcategory'))
      return jsonObject.filter(elem => !(elem.hasOwnProperty('rowGroup') && elem.hasOwnProperty('category') && elem.hasOwnProperty('subCategory')));

    }
  } catch (err) {
    console.error("validateThereOfJsonStr: failed to parse JSON", err);
  }
  return ["Invalid JSON structure"]
}

export function validatePartOfJsonStr(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const jsonObject = JSON.parse(value);
    if (jsonObject instanceof Array) {
      // return newObj.filter(elem => elem.hasOwnProperty('rowgroup') && elem.hasOwnProperty('category') && elem.hasOwnProperty('subcategory'))
      return jsonObject.filter(elem => !(elem.hasOwnProperty('rowGroup') && elem.hasOwnProperty('category')));

    }
  } catch (e) {
    console.error("validatePartOfJsonStr: failed to parse JSON", e);
  }
  return ["Invalid JSON structure"]
}



export function isValidi18nMode(value: string): boolean {
  return value?.trim().toUpperCase() in I18nMode;
}

export function isValidMeasureType(value: string): boolean {
  return value?.trim().toUpperCase() in MeasureType;
}

export function isValidMeasureScale(value: string): boolean {
  return  ['_','k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y','m', 'μ', 'n', 'p', 'P', 'f', 'a', 'z', 'y'].includes(value?.trim()) ||
          ['GREATEST', 'LEAST'].includes(value?.trim().toUpperCase());
}

export function validateI18nString(value: string): string[]  {
  if (isBlankInput(value)) {
    return [];
  }
  try {
    const jsonObject = JSON.parse(value);
    let errList = [];

    for (var value in jsonObject) {
      if (typeof jsonObject[value] === 'object'){
        errList.push(value +":"+jsonObject[value]);
      }
      return errList;
    }

  } catch (e) {
    console.error("validateI18nString: failed to parse JSON", e);
  }

  return ["Invalid JSON structure"]
}


export function validateStylesString(value: string): string[] {
  if (isBlankInput(value)) {
    return [];
  }
  try {
    JSON.parse(value);
    return [];
  } catch (e) {
    console.error("validateStylesString: failed to parse JSON", e);
  }

  return ["Invalid JSON structure"];
}

export function isTableCategoryWidth(value: string): boolean {
  return value?.toUpperCase().trim() in TableCategoryWidth;
}

export function validateColumnThereOfJsonStr(value: string): string[] {
  
  if (isBlankInput(value)) {
    return [];
  }

  try {
    const jsonObject = JSON.parse(value);
    return jsonObject.filter(elem => !(elem.hasOwnProperty('scenario') && elem.hasOwnProperty('name') && elem.hasOwnProperty('subGroups')))
  } catch (e) {
    console.error("validateColumnThereOfJsonStr: failed to parse JSON", e);
  }

  return ["Invalid JSON structure"];
}

// @ts-ignore - Parameter reserved for future validation
export function isValidFontSize(value: string): boolean {
  return true;
}

// @ts-ignore - Parameter reserved for future validation
export function isValidFontFamily(value: string): boolean {
  return true;
}

export function isValidTreeDirection(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }
  return ['ltr', 'rtl', 'ttb', 'btt'].includes(value?.toLowerCase().trim());
}

export function isValidEdgeStyle(value: string): boolean {
  if (isBlankInput(value)) {
    return false;
  }
  return ['straight', 'orthogonal', 'curved'].includes(value?.toLowerCase().trim());
}

export function validateTreeEdgesJson(value: string): string[] {
  if (isBlankInput(value)) {
    return ['edges: value is required'];
  }

  try {
    const jsonObject = JSON.parse(value);
    if (!Array.isArray(jsonObject)) {
      return ['edges: must be an array'];
    }

    if (jsonObject.length === 0) {
      return ['edges: array must not be empty'];
    }

    const errors: string[] = [];
    const validOperators = ['*', '/', '+', '-', 'x', '÷', 'none'];

    jsonObject.forEach((edge, index) => {
      if (typeof edge !== 'object' || edge === null) {
        errors.push(`edges[${index}]: must be an object`);
        return;
      }

      if (typeof edge.from !== 'string' || edge.from.trim() === '') {
        errors.push(`edges[${index}]: 'from' is required`);
      }

      if (typeof edge.to !== 'string' || edge.to.trim() === '') {
        errors.push(`edges[${index}]: 'to' is required`);
      }

      if (edge.operator !== undefined && !validOperators.includes(edge.operator)) {
        errors.push(`edges[${index}]: 'operator' must be one of: ${validOperators.join(', ')}`);
      }
    });

    return errors;
  } catch (e) {
    console.error("validateTreeEdgesJson: failed to parse JSON", e);
    return ['edges: invalid JSON structure'];
  }
}
