//const isBlank =
export function isBlankString(value: any): boolean {
    return typeof value !== 'string' || value === '';
}

export function validateScenarioList(value: string): string[] {
    let result: string[] = [];
    let supportedScenarios: string[] = ['ac','py','pl','fc'];

    if(!isBlankString(value)){
        result = value.split(',').filter(element => !supportedScenarios.includes(element));
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

