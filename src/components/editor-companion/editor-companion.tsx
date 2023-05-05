import { Component, Fragment, Method, h } from "@stencil/core";
import { BN_INTERNATIONALIZATION_KEYS } from "../../stores/internationalization";

@Component({
    tag: 'editor-companion',
    styleUrl: 'editor-companion.scss',
})
export class EditorCompanion {
    constructor() {
        window["BN_INTERNATIONALIZATION_KEYS"] = BN_INTERNATIONALIZATION_KEYS
        console.log('EditorCompanion loaded');
    }

    @Method()
    internationalizationKeys(): Promise<string[]> {
        return Promise.resolve(BN_INTERNATIONALIZATION_KEYS)
    }

    render() {
        return <Fragment></Fragment>
    }
}