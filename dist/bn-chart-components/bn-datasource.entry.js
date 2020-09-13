import { r as registerInstance, h, e as Host } from './index-947c0ad3.js';
import { s as set } from './datasource-c851b622.js';

const bnDatasourceCss = "bn-datasource{display:none}";

const Datasource = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /**
         * single or collection
         */
        this.type = 'single';
        setInterval(() => {
            set("test", { abc: new Date().getMilliseconds() });
        }, 1000);
    }
    render() {
        return h(Host, null);
    }
};
Datasource.style = bnDatasourceCss;

export { Datasource as bn_datasource };
