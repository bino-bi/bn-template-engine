export interface ContextState {
    isPreview: boolean;
    dataSources: {};
    updateDataSource?: (name: string, data: object, hash?: string) => void;
}
declare const _default: {
    Provider: import("@stencil/state-tunnel/dist/types/stencil.core").FunctionalComponent<{
        state: ContextState;
    }>;
    Consumer: import("@stencil/state-tunnel/dist/types/stencil.core").FunctionalComponent<{}>;
    injectProps: (Cstr: any, fieldList: import("@stencil/state-tunnel/dist/types/declarations").PropList<ContextState>) => void;
};
export default _default;
