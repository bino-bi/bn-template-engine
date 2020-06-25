export declare class Context {
    /**
     * Enable the preview mode to generate fake data.
     */
    isPreview: boolean;
    constructor();
    dataSources: {};
    dataSourceHashCache: {};
    /**
     *
     * @param name
     * @param data
     * @param hash is used to avoid data regenerating on tempalte content changed in preview mode. Data should only create if the data schema changed.
     */
    updateDataSource(name: string, data: object, hash?: string): void;
    render(): any;
}
