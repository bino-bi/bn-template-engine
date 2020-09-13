export declare class Datasource {
    constructor();
    /**
     * Unique (template scope) name of the datasource
     */
    name: string;
    /**
     * single or collection
     */
    type: string;
    render(): any;
}
