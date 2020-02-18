import hash from '@emotion/hash'

interface AttributeInfo {
  className: string;
  cssName: string;
  attrName: string;
}

export interface ClassStyle {
  className: string;
  style: string;
}

const width: AttributeInfo = {
  className: 'w',
  cssName: 'width',
  attrName: 'width'
};

const height: AttributeInfo = {
  className: 'h',
  cssName: 'height',
  attrName: 'height'
};

const position: AttributeInfo = {
  className: 'pst',
  cssName: 'position',
  attrName: 'position',
};

const top: AttributeInfo = {
  className: 'top',
  cssName: 'top',
  attrName: 'top',
};

const right: AttributeInfo = {
  className: 'rgt',
  cssName: 'right',
  attrName: 'right'
};

const bottom: AttributeInfo = {
  className: 'btm',
  cssName: 'bottom',
  attrName: 'bottom'
};

const left: AttributeInfo = {
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

function getClassName(attr: AttributeInfo, value: string): string {
  const valueKey = hash(value);
  return `bn-c-${attr.className}_${valueKey}`
}

function getStyle(attr: AttributeInfo, className: string, value: string): string {
  return `.${className} {${attr.cssName}: ${value};}`;
}

function getCSS(attr: AttributeInfo, value: string): ClassStyle {
  const className = getClassName(attr, value);
  const style = getStyle(attr, className, value);
  return {className, style};
}

export const apply = (el: Element): Map<string, ClassStyle> => {
  const map = new Map<string, ClassStyle>();
  attributesNames.forEach(name => {
    const value = el.getAttribute(name);
    if (value) {
      map.set(name, getCSS(attributes[name], value))
    }
  });

  return map;
};
