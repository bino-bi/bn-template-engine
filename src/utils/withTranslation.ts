import { default as context } from "../stores/context"
import { default as locales } from "../stores/internationalization"
import * as _ from "lodash";
import { getElement } from "@stencil/core";

const withTranslation = (component: any) => {
  const t = (key: string,  namespace: string = "_system", data?: object) => {

    if (key.startsWith('.')) {
      key = getElement(component).localName + key;
    }
        
    if (locales[namespace] == null) {
      namespace = "_system";
    }
    console.debug({"locales": locales, 
                   "namespace": namespace,
                   "locale":context.locale,
                   "key": key,
                   "data": data});
    return _.template(locales[namespace][context.locale][key], { interpolate: /{{([\s\S]+?)}}/g })(data)
  };

  return { t }
}

export default withTranslation;
