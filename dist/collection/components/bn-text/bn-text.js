import { Component, h, Host, Element, Prop } from "@stencil/core";
import { styled } from "../../utils/styled/styled";
import Tunnel from '../../data/context';
export class Text {
    constructor() {
        this.scopedEval = (scope, script) => Function(`"use strict"; return ${script}`).bind(scope)();
    }
    render() {
        return h(Host, null, this.scopedEval(this.dataSources, "`" + this.value + "`"));
    }
    static get is() { return "bn-text"; }
    static get originalStyleUrls() { return {
        "$": ["bn-text.scss"]
    }; }
    static get styleUrls() { return {
        "$": ["bn-text.css"]
    }; }
    static get properties() { return {
        "value": {
            "type": "string",
            "mutable": false,
            "complexType": {
                "original": "string",
                "resolved": "string",
                "references": {}
            },
            "required": false,
            "optional": true,
            "docs": {
                "tags": [],
                "text": ""
            },
            "attribute": "value",
            "reflect": false
        },
        "dataSources": {
            "type": "unknown",
            "mutable": false,
            "complexType": {
                "original": "{}",
                "resolved": "{}",
                "references": {}
            },
            "required": false,
            "optional": false,
            "docs": {
                "tags": [],
                "text": ""
            }
        }
    }; }
    static get elementRef() { return "element"; }
}
Tunnel.injectProps(Text, ['dataSources']);
styled(Text);
