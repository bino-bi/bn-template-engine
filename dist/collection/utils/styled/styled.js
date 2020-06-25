import { styleSheet } from './style-sheet';
import { apply, attributesNames } from './attributes';
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        const el = mutation.target;
        const map = apply(el);
        styleSheet.apply(map);
        const classes = Array.from(map.values()).map(value => value.className);
        el.className = el.className.split(" ").filter(value => !value.startsWith("bn-c-")).concat(...classes).join(" ");
    }
});
const subscribe = (el) => {
    console.dir(el);
    const map = apply(el);
    styleSheet.apply(map);
    const classes = Array.from(map.values()).map(value => value.className);
    el.className = el.className.split(" ").filter(value => !value.startsWith("bn-c-")).concat(...classes).join(" ");
    observer.observe(el, { attributes: true, attributeFilter: attributesNames, childList: false, subtree: false });
};
export const styled = (Cstr) => {
    console.dir(Cstr);
    const CstrPrototype = Cstr.prototype;
    const cstrConnectedCallback = CstrPrototype.connectedCallback;
    const cstrDisconnectedCallback = CstrPrototype.disconnectedCallback;
    CstrPrototype.connectedCallback = function () {
        if (this.element) {
            subscribe(this.element);
        }
        else {
            throw new Error(`Can't find element field in component ${this}`);
        }
        if (cstrConnectedCallback) {
            return cstrConnectedCallback.call(this);
        }
    };
    CstrPrototype.disconnectedCallback = function () {
        if (cstrDisconnectedCallback) {
            cstrDisconnectedCallback.call(this);
        }
    };
};
