import { r as registerInstance, h, e as Host } from './index-6253379c.js';

const bnBodyCss = "bn-body{flex:1}";

const Body = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
    }
    render() {
        return h(Host, null);
    }
};
Body.style = bnBodyCss;

export { Body as bn_body };
