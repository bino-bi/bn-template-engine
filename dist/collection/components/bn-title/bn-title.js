import { Component, h, Host } from "@stencil/core";
export class Title {
    render() {
        return h(Host, null);
    }
    static get is() { return "bn-title"; }
    static get originalStyleUrls() { return {
        "$": ["bn-title.scss"]
    }; }
    static get styleUrls() { return {
        "$": ["bn-title.css"]
    }; }
}
