export declare class Datasource {
    constructor();
    private currentSchema;
    /**
     * Unique (template scope) name of the datasource
     */
    name: string;
    /**
     * single or collection
     */
    type: string;
    isPreview: boolean;
    updateDataSource?: (name: string, data: object, hash?: string) => void;
    contentModified(event: MutationEvent): void;
    emitData(data: any, hash?: string): Promise<void>;
    private generate;
    render(): any;
}
