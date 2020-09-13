import { r as registerInstance, h, e as Host, g as getElement } from './index-947c0ad3.js';
import { s as styled } from './styled-89a75ade.js';

const bnTextCss = "bn-text{position:relative;display:inline}";

const Text = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.scopedEval = (scope, script) => Function(`"use strict"; return ${script}`).bind(scope)();
    }
    render() {
        return h(Host, null, this.scopedEval(this.dataSources, "`" + this.value + "`"));
    }
    get element() { return getElement(this); }
};
styled(Text);
Text.style = bnTextCss;

export { Text as bn_text };
