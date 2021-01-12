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