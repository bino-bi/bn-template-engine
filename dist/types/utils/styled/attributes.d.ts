export interface ClassStyle {
    className: string;
    style: string;
}
export declare const attributesNames: string[];
export declare const apply: (el: Element) => Map<string, ClassStyle>;
