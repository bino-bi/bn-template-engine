import { r as registerInstance, h, e as Host, g as getElement } from './index-6253379c.js';
import { s as styled } from './styled-6af7d37c.js';
import './hash.browser.esm-715d0bba.js';
import { T as Tunnel } from './context-2c0dcaee.js';

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
Tunnel.injectProps(Text, ['dataSources']);
styled(Text);
Text.style = bnTextCss;

export { Text as bn_text };
