import { Component, h, Host } from "@stencil/core";
export class Body {
    render() {
        return h(Host, null);
    }
    static get is() { return "bn-body"; }
    static get originalStyleUrls() { return {
        "$": ["bn-body.scss"]
    }; }
    static get styleUrls() { return {
        "$": ["bn-body.css"]
    }; }
}
