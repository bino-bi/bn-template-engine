import {default as context} from "../stores/context"
import {default as locales} from "../stores/internationalization"
import * as _ from "lodash";

const withTranslation = () => {
  const t = (key: string, data?: object) => {
    return _.template(locales[context.locale][key], {interpolate: /{{([\s\S]+?)}}/g})(data)
  };

  return {t}
}

export default withTranslation;
