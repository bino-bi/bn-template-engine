export declare class Table {
    private element;
    tableTitle: string;
    scenarios: string;
    grouped: boolean;
    type: string;
    showGroupTitle: boolean;
    limit?: number;
    thereof?: string;
    order?: string;
    orderDirection?: string;
    datasouce: any;
    unsubscribe: () => void;
    componentWillLoad(): void;
    componentDidUnload(): void;
    render(): any;
}
