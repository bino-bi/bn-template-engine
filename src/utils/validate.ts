//const isBlank =
export function isBlankString(value: any): boolean {
    return typeof value !== 'string' || value === '';
}

export function validateScenarioList(value: string): string[] {
    let result: string[] = [];
    let supportedScenarios: string[] = ['ac','py','pl','fc',
                                        'ac2','py2','pl2','fc2',
                                        'ac3','py3','pl3','fc3',
                                        'ac4','py4','pl4','fc4',];

    if(!isBlankString(value)){
        result = value.split(',').filter(element => !supportedScenarios.includes(element));
    }

    result = validateVariancesList(result.toString());
    return result;
}

export function validateScenarioUnitType(value: string): string [] {
  let result: string[] = [];
  let supportedScenarioTypes: string[] = ['decimal', 'percent'];

  if(!isBlankString(value)){
    result = value.split(',').filter(element => !supportedScenarioTypes.includes(element));
  }

  return result
}

export function validateVariancesList(value: string): string[] {
    let result: string[] = [];
    let supportedScenarios: string[] = ['ac','py','pl','fc',
                                        'ac2','py2','pl2','fc2',
                                        'ac3','py3','pl3','fc3',
                                        'ac4','py4','pl4','fc4'];
     let supportedDirection: string[] = ['pos','neg','neu'];


    if(!isBlankString(value)){
        result = value.split(',').filter(element=> {
            let splitted = element.split('_');
            let subStringOffset = 1;

            if( splitted[0].substring(0,2) === 'dr'){
              subStringOffset = 2;
            }

            return splitted.length != 3 ||
                   !supportedScenarios.includes(splitted[0].substring(subStringOffset)) ||
                   !supportedScenarios.includes(splitted[1]) ||
                   !supportedDirection.includes(splitted[2]);
        }
        );
    }

    return result;
}



export function isValidDateLink(value: any): boolean {
    const validValues: string[] =["avg" , "interval" , "cum" , "start" , "end" , "ytd" , "ytg" , "cum"  , "mat" , "none"  ];
    return validValues.some( elem => elem === value);
}

export function isValidDateFormat(value: any): boolean {
    const validValues: string[] =["year" , "quarter" , "month" , "week" , "day" , "hour" , "auto" , "fallback" ];
    return validValues.some( elem => elem === value);
}

export function isValidDate(value: any): boolean {
    const newDate: number = Date.parse(value);
    return Number.isInteger(newDate);
}

export function isValidMeasure(value: any): boolean {

        const newObj = JSON.parse(value);
        if(newObj instanceof Array){
           return newObj.every(elem => elem.hasOwnProperty('name') && elem.hasOwnProperty('unit'))
        }
        else {
            return false;
        }

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

export function isValidOrderList(value: string): string[] {
    let result: string[] = [];
    let supportedScenarios: string[] = [ 'ac','py','pl','fc',
                                         'ac2','py2','pl2','fc2',
                                         'ac3','py3','pl3','fc3',
                                         'ac4','py4','pl4','fc4',
                                         'category', 'categoryindex' ,'rowgroup' , 'rowgroupindex' ];

    if(!isBlankString(value)){
        result = value.split(',').filter(element => !supportedScenarios.includes(element));
    }

    return result;
}

export function isValidDirection(value: any): boolean {
    const validValues: string[] =["asc" , "desc"];
    return validValues.some( elem => elem === value);
}

export function isValidi18nMode(value: any): boolean {
    const validValues: string[] =["none" , "all", "meta"];
    return validValues.some( elem => elem === value);
}





