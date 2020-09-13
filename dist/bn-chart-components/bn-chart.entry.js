import { r as registerInstance, h, e as Host, g as getElement } from './index-947c0ad3.js';
import { s as styled } from './styled-89a75ade.js';

const Chart = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
    }
    render() {
        return h(Host, null, h("ibcs-chart-structure", null));
    }
    get element() { return getElement(this); }
};
styled(Chart);

export { Chart as bn_chart };
