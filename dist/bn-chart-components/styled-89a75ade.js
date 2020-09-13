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

/* eslint-disable */
// murmurhash2 via https://github.com/garycourt/murmurhash-js/blob/master/murmurhash2_gc.js
function murmurhash2_32_gc(str) {
  var l = str.length,
      h = l ^ l,
      i = 0,
      k;

  while (l >= 4) {
    k = str.charCodeAt(i) & 0xff | (str.charCodeAt(++i) & 0xff) << 8 | (str.charCodeAt(++i) & 0xff) << 16 | (str.charCodeAt(++i) & 0xff) << 24;
    k = (k & 0xffff) * 0x5bd1e995 + (((k >>> 16) * 0x5bd1e995 & 0xffff) << 16);
    k ^= k >>> 24;
    k = (k & 0xffff) * 0x5bd1e995 + (((k >>> 16) * 0x5bd1e995 & 0xffff) << 16);
    h = (h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0x5bd1e995 & 0xffff) << 16) ^ k;
    l -= 4;
    ++i;
  }

  switch (l) {
    case 3:
      h ^= (str.charCodeAt(i + 2) & 0xff) << 16;

    case 2:
      h ^= (str.charCodeAt(i + 1) & 0xff) << 8;

    case 1:
      h ^= str.charCodeAt(i) & 0xff;
      h = (h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0x5bd1e995 & 0xffff) << 16);
  }

  h ^= h >>> 13;
  h = (h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0x5bd1e995 & 0xffff) << 16);
  h ^= h >>> 15;
  return (h >>> 0).toString(36);
}

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
const fontSize = {
    className: 'fts',
    cssName: 'font-size',
    attrName: 'font-size'
};
const attributes = {
    "width": width,
    "height": height,
    "position": position,
    "top": top,
    "right": right,
    "bottom": bottom,
    "left": left,
    "font-size": fontSize
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
