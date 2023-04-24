import { Component, Fragment, h } from "@stencil/core";
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

    render() {
        return <Fragment></Fragment>
    }
}