import { Component, h, Host } from "@stencil/core";
export class Template {
    render() {
        return h(Host, null);
    }
    static get is() { return "bn-template"; }
}
