export declare class Template {
    /**
     * Define the size of the page
     *
     * values: xga | hd | full-hd | 4k | 4k2k | a4 | a3 | a2 | a1 | a0 | letter | legal
     * default: xga
     */
    format: String;
    /**
     * values: landscape | portrait
     * default: based on the given format
     */
    orientation: String;
    validateFormat(newValue: String, oldValue: String): void;
    validateOrientation(newValue: String, oldValue: String): void;
    render(): any;
}
