import { getStores, clearStoresCache, ScopedStores } from "../context/context-protocol";
import { forceUpdate, getElement } from "@stencil/core";
import { runIfExisits } from "./utils";

/**
 * Mixin that provides i18n translation support to a Stencil component.
 *
 * Returns an object with a `t(key, data?)` function for looking up translated strings.
 *
 * **Key resolution shortcuts:**
 * - A key starting with `.` (e.g. `.label`) is expanded to `<component-tag>.label`,
 *   allowing components to reference their own translations concisely.
 * - If the key is not found in the component's namespace, the `_system` namespace
 *   is used as a fallback.
 *
 * **Mustache-style interpolation:** `{{variable}}` placeholders in translation
 * templates are replaced with values from the optional `data` object.
 *
 * The mixin observes the `namespace` attribute on the host element and re-renders
 * the component when the locale store updates for the active namespace.
 *
 * @param component - The Stencil component instance
 * @returns Object containing the `t` translation function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withTranslation = (component: any) => {
  let subscription: () => void;
  let namespace: string | undefined = undefined;
  let stores: ScopedStores;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "namespace") {
        namespace = getElement(component).getAttribute("namespace");
        forceUpdate(component);
      }
    });
  });

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    stores = getStores(element);

    observer.observe(element, { attributes: true, attributeFilter: ["namespace"] });

    namespace = getElement(component).getAttribute("namespace");

    subscription = stores.internationalization.on("set", (key, _value) => {
      if (key == namespace) {
        forceUpdate(component);
      }
    });

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    observer.disconnect();
    runIfExisits(subscription);
    clearStoresCache(getElement(component));
    runIfExisits(disconnectedCallback, component);
  };

  const t = (key: string, data?: object) => {
    if (key.startsWith(".")) {
      key = getElement(component).localName + key;
    }

    const locales = stores.internationalization.state;
    const locale = stores.context.state.locale;

    let currentNamespace = namespace;

    if (locales[currentNamespace]?.[locale]?.[key] == null) {
      currentNamespace = "_system";
    }

    const tpl = locales[currentNamespace][locale][key];
    return tpl.replace(/{{([\s\S]+?)}}/g, (_: string, k: string) => data?.[k.trim()] ?? "");
  };

  return { t };
};

export default withTranslation;
