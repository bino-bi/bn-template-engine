import { ClassStyle } from "./attributes";
declare class StyleSheet {
    private readonly tag;
    private cache;
    constructor();
    private static makeStyleTag;
    apply(data: Map<string, ClassStyle>): void;
}
export declare const styleSheet: StyleSheet;
export {};
