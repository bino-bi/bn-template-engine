import {getElement} from "@stencil/core";

export const getContext = (ref: any) => {
  const elm = getElement(ref)
  if(elm) {
    return elm.closest('bn-context')
  } else {
    return undefined;
  }
}
