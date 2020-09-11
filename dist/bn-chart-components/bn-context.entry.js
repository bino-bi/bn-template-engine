import { r as registerInstance, h } from './index-6253379c.js';
import { T as Tunnel } from './context-2c0dcaee.js';

const Context = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
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
        console.dir(["lalala", data]);
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
        return (h(Tunnel.Provider, { state: state }, h("slot", null)));
    }
};

export { Context as bn_context };
