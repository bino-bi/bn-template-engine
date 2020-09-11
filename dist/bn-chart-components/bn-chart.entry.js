import { r as registerInstance, h, e as Host, g as getElement } from './index-6253379c.js';
import { s as styled } from './styled-6af7d37c.js';
import './hash.browser.esm-715d0bba.js';
import { T as Tunnel } from './context-2c0dcaee.js';

const Chart = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
    }
    render() {
        return h(Host, null, h("ibcs-chart-structure", null));
    }
    get element() { return getElement(this); }
};
Tunnel.injectProps(Chart, ['dataSources']);
styled(Chart);

export { Chart as bn_chart };
