import {getElement} from "@stencil/core";
import state from "../stores/componentStyles";

const withComponentStyle = (component: any) => {

  const componentStyle = (name: string = 'default') => {
    try {
      const localName = getElement(component)?.localName
        if(localName)
        return {...state['bn-page'][name], ...state[localName][name]}
    } catch {
      return {}
    }
  }

  return {componentStyle}
}

export default withComponentStyle;
