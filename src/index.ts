// Do not delete is mandatory for using ibcs-compnents in JS
import '@bino-bi/ibcs-component/dist';
import { BN_INTERNATIONALIZATION_KEYS } from './stores/internationalization';
export * from './components';

window["BN_INTERNATIONALIZATION_KEYS"] = BN_INTERNATIONALIZATION_KEYS
