import { Component, Prop, h, Host, Listen, Method } from "@stencil/core";
import Tunnel from '../../data/context';
import faker from "faker";
import hash from '@emotion/hash';
export class Datasource {
    constructor() {
        this.currentSchema = undefined;
        /**
         * single or collection
         */
        this.type = 'single';
        this.emitData = this.emitData.bind(this);
        this.contentModified = this.contentModified.bind(this);
    }
    contentModified(event) {
        const target = event.target;
        this.currentSchema = JSON.parse(target.data || target.innerText);
        if (this.isPreview) {
            this.emitData(this.generate(this.currentSchema, this.type == 'single' ? 1 : 10), hash(JSON.stringify(this.currentSchema)));
        }
    }
    async emitData(data, hash) {
        this.updateDataSource(this.name, data, hash);
    }
    generate(schema, rows) {
        const keys = Object.keys(schema);
        const columns = keys.map((value) => {
            const def = schema[value];
            return [...Array(rows)].map(() => {
                switch (def.type) {
                    case 'date': {
                        return faker.date.recent();
                    }
                    case 'string': {
                        return faker.random.word();
                    }
                    case 'integer': {
                        return faker.random.number(15);
                    }
                    case 'collection': {
                        return this.generate(def.schema, 3);
                    }
                    case 'single': {
                        return this.generate(def.schema, 1);
                    }
                    case String(/^\[.*\]$/.test(def.type) ? def.type : {}): {
                        return this.generate({ __: { type: def.type.substr(1, def.type.length - 2) } }, 3).map((value) => value.__);
                    }
                }
            });
        });
        const result = [...Array(rows)].map((_, i) => {
            const item = {};
            keys.forEach((key, j) => {
                item[key] = columns[j][i];
            });
            return item;
        });
        if (result.length == 1) {
            return result[0];
        }
        else {
            return result;
        }
    }
    render() {
        return h(Host, null);
    }
    static get is() { return "bn-datasource"; }
    static get originalStyleUrls() { return {
        "$": ["bn-datasource.css"]
    }; }
    static get styleUrls() { return {
        "$": ["bn-datasource.css"]
    }; }
    static get properties() { return {
        "name": {
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
                "text": "Unique (template scope) name of the datasource"
            },
            "attribute": "name",
            "reflect": false
        },
        "type": {
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
                "text": "single or collection"
            },
            "attribute": "type",
            "reflect": false,
            "defaultValue": "'single'"
        },
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
                "text": ""
            },
            "attribute": "is-preview",
            "reflect": false
        },
        "updateDataSource": {
            "type": "unknown",
            "mutable": false,
            "complexType": {
                "original": "(name: string, data: object, hash?: string) => void",
                "resolved": "(name: string, data: object, hash?: string) => void",
                "references": {}
            },
            "required": false,
            "optional": true,
            "docs": {
                "tags": [],
                "text": ""
            }
        }
    }; }
    static get methods() { return {
        "emitData": {
            "complexType": {
                "signature": "(data: any, hash?: string) => Promise<void>",
                "parameters": [{
                        "tags": [],
                        "text": ""
                    }, {
                        "tags": [],
                        "text": ""
                    }],
                "references": {
                    "Promise": {
                        "location": "global"
                    }
                },
                "return": "Promise<void>"
            },
            "docs": {
                "text": "",
                "tags": []
            }
        }
    }; }
    static get listeners() { return [{
            "name": "DOMSubtreeModified",
            "method": "contentModified",
            "target": undefined,
            "capture": false,
            "passive": false
        }]; }
}
Tunnel.injectProps(Datasource, ['updateDataSource', 'isPreview']);
