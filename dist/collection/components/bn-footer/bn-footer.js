import { Component, h, Host } from "@stencil/core";
export class Footer {
    render() {
        return h(Host, null);
    }
    static get is() { return "bn-footer"; }
}
