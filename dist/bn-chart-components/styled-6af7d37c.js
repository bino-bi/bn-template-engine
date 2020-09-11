import { m as murmurhash2_32_gc } from './hash.browser.esm-715d0bba.js';

class StyleSheet {
    constructor() {
        this.cache = new Map();
        this.tag = StyleSheet.makeStyleTag();
    }
    static makeStyleTag() {
        const tag = document.createElement('style');
        tag.type = 'text/css';
        tag.setAttribute('data-bn-computed-style', '');
        tag.append(document.createTextNode(''));
        (document.head || document.querySelector('head')).append(tag);
        return tag;
    }
    apply(data) {
        data.forEach(value => this.cache.set(value.className, value.style));
        this.tag.innerHTML = Array.from(this.cache.values()).map(value => value).join("\n");
    }
}
const styleSheet = new StyleSheet();

const width = {
    className: 'w',
    cssName: 'width',
    attrName: 'width'
};
const height = {
    className: 'h',
    cssName: 'height',
    attrName: 'height'
};
const position = {
    className: 'pst',
    cssName: 'position',
    attrName: 'position',
};
const top = {
    className: 'top',
    cssName: 'top',
    attrName: 'top',
};
const right = {
    className: 'rgt',
    cssName: 'right',
    attrName: 'right'
};
const bottom = {
    className: 'btm',
    cssName: 'bottom',
    attrName: 'bottom'
};
const left = {
    className: 'lft',
    cssName: 'left',
    attrName: 'left'
};
const attributes = {
    "width": width,
    "height": height,
    "position": position,
    "top": top,
    "right": right,
    "bottom": bottom,
    "left": left,
};
const attributesNames = Object.keys(attributes);
function getClassName(attr, value) {
    const valueKey = murmurhash2_32_gc(value);
    return `bn-c-${attr.className}_${valueKey}`;
}
function getStyle(attr, className, value) {
    return `.${className} {${attr.cssName}: ${value};}`;
}
function getCSS(attr, value) {
    const className = getClassName(attr, value);
    const style = getStyle(attr, className, value);
    return { className, style };
}
const apply = (el) => {
    const map = new Map();
    map.set("position", getCSS(attributes["position"], "absolute"));
    attributesNames.forEach(name => {
        const value = el.getAttribute(name);
        if (value) {
            map.set(name, getCSS(attributes[name], value));
        }
    });
    console.dir(map);
    return map;
};

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
    const map = apply(el);
    styleSheet.apply(map);
    const classes = Array.from(map.values()).map(value => value.className);
    el.className = el.className.split(" ").filter(value => !value.startsWith("bn-c-")).concat(...classes).join(" ");
    observer.observe(el, { attributes: true, attributeFilter: attributesNames, childList: false, subtree: false });
};
const styled = (Cstr) => {
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

export { styled as s };
