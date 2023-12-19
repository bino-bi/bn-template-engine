
import { forceUpdate, getElement } from "@stencil/core";
import state, { Style, on } from "../stores/componentStyles";
import { runIfExisits } from "./utils";
import { merge } from '@corex/deepmerge'

const withComponentStyle = (component: any ) => {
  let subscription: () => void;
  
  let selectedStyle: string;
  let style: Style = state["_system"]
  
  const updateStyle = () => {    
    style = merge([state["_system"] || ({} as Style), state["_default"] || ({} as Style), state[selectedStyle] || ({} as Style)]);  
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'selected-style') {        
       
        selectedStyle = (getElement(component).getAttribute('selected-style'));        
        updateStyle();
        forceUpdate(component);
      }
    });
  });

  const connectedCallback = component['connectedCallback'];
  component['connectedCallback'] = () => {
    const element = getElement(component);
    observer.observe(element, { attributes: true, attributeFilter: ['selected-style'] });
    
    selectedStyle = (getElement(component).getAttribute('selected-style'));
    
    updateStyle();
    
    subscription = on("set", key => {    
      if (key === selectedStyle) {
        selectedStyle = (getElement(component).getAttribute('selected-style'));
        updateStyle();
        forceUpdate(getElement(component));
      }
    });    
    
    runIfExisits(connectedCallback, component);
  }

 

  const disconnectedCallback = component['disconnectedCallback'];
  component['disconnectedCallback'] = () => {
    observer.disconnect();
    runIfExisits(subscription);
    runIfExisits(disconnectedCallback, component);
  };

  const componentStyle = <T,>(q: ($style: Style) => T): T => {   
    return q(style);
  }

  

  return componentStyle
}

export default withComponentStyle;
