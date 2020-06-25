import { Component, h, Prop, State } from "@stencil/core";
import Tunnel from '../../data/context';
export class Context {
    constructor() {
        /**
         * Enable the preview mode to generate fake data.
         */
        this.isPreview = false;
        this.dataSources = {};
        this.dataSourceHashCache = {};
        this.updateDataSource = this.updateDataSource.bind(this);
    }
    /**
     *
     * @param name
     * @param data
     * @param hash is used to avoid data regenerating on tempalte content changed in preview mode. Data should only create if the data schema changed.
     */
    updateDataSource(name, data, hash) {
        if (this.isPreview) {
            if (this.dataSourceHashCache[name] !== hash) {
                this.dataSourceHashCache[name] = hash;
                this.dataSources = Object.assign(Object.assign({}, this.dataSources), { [name]: data });
            }
        }
        else {
            this.dataSources = Object.assign(Object.assign({}, this.dataSources), { [name]: data });
        }
    }
    render() {
        const state = {
            isPreview: this.isPreview,
            dataSources: this.dataSources,
            updateDataSource: this.updateDataSource
        };
        return (h(Tunnel.Provider, { state: state },
            h("slot", null)));
    }
    static get is() { return "bn-context"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "isPreview": {
            "type": "boolean",
            "mutable": false,
            "complexType": {
                "original": "boolean",
                "resolved": "boolean",
                "references": {}
            },
            "required": false,
            "optional": false,
            "docs": {
                "tags": [],
                "text": "Enable the preview mode to generate fake data."
            },
            "attribute": "is-preview",
            "reflect": false,
            "defaultValue": "false"
        }
    }; }
    static get states() { return {
        "dataSources": {}
    }; }
}
