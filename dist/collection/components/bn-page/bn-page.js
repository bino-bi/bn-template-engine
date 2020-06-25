import { Component, h, Host, Prop, Watch } from "@stencil/core";
export class Template {
    // @ts-ignore
    validateFormat(newValue, oldValue) {
        //TODO: add validation
    }
    // @ts-ignore
    validateOrientation(newValue, oldValue) {
        //TODO: add validation
    }
    render() {
        return h(Host, null);
    }
    static get is() { return "bn-page"; }
    static get originalStyleUrls() { return {
        "$": ["bn-page.scss"]
    }; }
    static get styleUrls() { return {
        "$": ["bn-page.css"]
    }; }
    static get properties() { return {
        "format": {
            "type": "unknown",
            "mutable": false,
            "complexType": {
                "original": "String",
                "resolved": "String",
                "references": {
                    "String": {
                        "location": "global"
                    }
                }
            },
            "required": false,
            "optional": false,
            "docs": {
                "tags": [],
                "text": "Define the size of the page\n\nvalues: xga | hd | full-hd | 4k | 4k2k | a4 | a3 | a2 | a1 | a0 | letter | legal\ndefault: xga"
            }
        },
        "orientation": {
            "type": "unknown",
            "mutable": false,
            "complexType": {
                "original": "String",
                "resolved": "String",
                "references": {
                    "String": {
                        "location": "global"
                    }
                }
            },
            "required": false,
            "optional": false,
            "docs": {
                "tags": [],
                "text": "values: landscape | portrait\ndefault: based on the given format"
            }
        }
    }; }
    static get watchers() { return [{
            "propName": "format",
            "methodName": "validateFormat"
        }, {
            "propName": "format",
            "methodName": "validateOrientation"
        }]; }
}
