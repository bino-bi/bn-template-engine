import hash from '@emotion/hash';
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
export const attributesNames = Object.keys(attributes);
function getClassName(attr, value) {
    const valueKey = hash(value);
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
export const apply = (el) => {
    const map = new Map();
    attributesNames.forEach(name => {
        const value = el.getAttribute(name);
        if (value) {
            map.set(name, getCSS(attributes[name], value));
        }
    });
    return map;
};
