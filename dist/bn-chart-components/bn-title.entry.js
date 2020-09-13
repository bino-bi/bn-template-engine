import { r as registerInstance, h, e as Host } from './index-947c0ad3.js';

const bnTitleCss = "bn-title{padding-bottom:0.5em;margin-bottom:0.5em;border-bottom:black solid 1px}";

const Title = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
    }
    render() {
        return h(Host, null);
    }
};
Title.style = bnTitleCss;

export { Title as bn_title };
