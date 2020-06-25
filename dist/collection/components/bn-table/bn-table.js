import { Component, Element, h, Host, Prop } from "@stencil/core";
import { styled } from "../../utils/styled/styled";
import Tunnel from "../../data/context";
export class Table {
    render() {
        return h(Host, null,
            h("ibcs-table", { scenarios: ['a', 'b', 'c'] }));
    }
    static get is() { return "bn-table"; }
    static get properties() { return {
        "elementTitle": {
            "type": "string",
            "mutable": false,
            "complexType": {
                "original": "string",
                "resolved": "string",
                "references": {}
            },
            "required": false,
            "optional": false,
            "docs": {
                "tags": [],
                "text": ""
            },
            "attribute": "element-title",
            "reflect": false
        },
        "scenarios": {
            "type": "string",
            "mutable": false,
            "complexType": {
                "original": "string",
                "resolved": "string",
                "references": {}
            },
            "required": false,
            "optional": false,
            "docs": {
                "tags": [],
                "text": ""
            },
            "attribute": "scenarios",
            "reflect": false
        }
    }; }
    static get elementRef() { return "element"; }
}
Tunnel.injectProps(Table, ['dataSources']);
styled(Table);
