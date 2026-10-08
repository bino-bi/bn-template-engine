import { getStores, clearStoresCache, ScopedStores } from "../context/context-protocol";
import { forceUpdate, getElement } from "@stencil/core";
import { runIfExisits } from "./utils";
import { findAncestorWithAttr } from "./withInheritedProps";
import { RENAMED_I18N_KEYS } from "../stores/internationalization";

/**
 * Mixin that provides i18n translation support to a Stencil component.
 *
 * Returns an object with a `t(key, data?)` function for looking up translated strings.
 *
 * **Namespace resolution** (mirrors the ancestor inheritance of `withRuleSet`,
 * but on by default):
 * 1. The component's own `i18nNamespace` prop (attribute `i18n-namespace`).
 * 2. Otherwise the `i18n-namespace` attribute of the nearest ancestor that
 *    carries one - a layout card, layout page, tree, grid, or the
 *    `bn-context` itself - crossing shadow boundaries. The resolved ancestor
 *    is observed so attribute changes re-render the component.
 * 3. Otherwise the built-in `_system` namespace.
 *
 * **Key resolution shortcuts:**
 * - A key starting with `.` (e.g. `.label`) is expanded to `<component-tag>.label`,
 *   allowing components to reference their own translations concisely.
 * - If the key is not found in the component's namespace, the `_system` namespace
 *   is used as a fallback; if it is missing there too (or the locale is unknown),
 *   the key itself is returned.
 *
 * **Mustache-style interpolation:** `{{variable}}` placeholders in translation
 * templates are replaced with values from the optional `data` object. The
 * separate `{%}` scenario token used by the variance symbols is substituted
 * later, by `Formatter.translateScenarioLabel`.
 *
 * @param component - The Stencil component instance
 * @returns Object containing the `t` translation function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withTranslation = (component: any) => {
  let subscription: () => void;
  let namespace: string | undefined = undefined;
  /** The `i18nNamespace` prop value that `namespace` was resolved for. */
  let ownNamespace: string | null | undefined = undefined;
  let stores: ScopedStores;

  let ancestorObserver: MutationObserver | null = null;

  const resolveNamespace = () => {
    const element = getElement(component);

    if (ancestorObserver) {
      ancestorObserver.disconnect();
      ancestorObserver = null;
    }

    ownNamespace = component.i18nNamespace;
    namespace = ownNamespace;
    if (namespace != null) {
      return;
    }

    const ancestor = findAncestorWithAttr(element, "i18n-namespace");
    if (ancestor) {
      namespace = ancestor.getAttribute("i18n-namespace");
      ancestorObserver = new MutationObserver(() => {
        resolveNamespace();
        forceUpdate(component);
      });
      ancestorObserver.observe(ancestor, { attributes: true, attributeFilter: ["i18n-namespace"] });
    }
  };

  const connectedCallback = component["connectedCallback"];
  component["connectedCallback"] = () => {
    const element = getElement(component);
    stores = getStores(element);

    resolveNamespace();

    subscription = stores.internationalization.on("set", (key, _value) => {
      if (key === namespace || key === "_system") {
        forceUpdate(component);
      }
    });

    runIfExisits(connectedCallback, component);
  };

  const disconnectedCallback = component["disconnectedCallback"];
  component["disconnectedCallback"] = () => {
    if (ancestorObserver) {
      ancestorObserver.disconnect();
      ancestorObserver = null;
    }
    runIfExisits(subscription);
    clearStoresCache(getElement(component));
    runIfExisits(disconnectedCallback, component);
  };

  const t = (key: string, data?: object) => {
    // A change of the prop renders the component, and texts are looked up while it renders:
    // compared here, a property write counts like an attribute.
    if (stores !== undefined && component.i18nNamespace !== ownNamespace) {
      resolveNamespace();
    }

    if (key.startsWith(".")) {
      key = getElement(component).localName + key;
    }
    key = RENAMED_I18N_KEYS[key] ?? key;

    const locales = stores.internationalization.state;
    const locale = stores.context.state.locale;

    // Per-key fallback chain: resolved namespace → _system → the key itself.
    // Never throws - a missing key or unknown locale must not blank the component.
    const tpl = locales[namespace]?.[locale]?.[key] ?? locales["_system"]?.[locale]?.[key];
    if (tpl == null) {
      return key;
    }
    return tpl.replace(/{{([\s\S]+?)}}/g, (_: string, k: string) => data?.[k.trim()] ?? "");
  };

  return { t };
};

export default withTranslation;
