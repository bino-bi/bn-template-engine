import { default as context } from "../stores/context";
import { default as locales, on } from "../stores/internationalization";
import { forceUpdate, getElement } from "@stencil/core";
import { runIfExisits } from "./utils";

const withTranslation = (component: any) => {
  let subscription: () => void;
  let namespace: string | undefined = undefined;

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
    observer.observe(element, { attributes: true, attributeFilter: ["namespace"] });

    namespace = getElement(component).getAttribute("namespace");

    subscription = on("set", (key, _value) => {
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
    runIfExisits(disconnectedCallback, component);
  };

  const t = (key: string, data?: object) => {
    if (key.startsWith(".")) {
      key = getElement(component).localName + key;
    }

    let currentNamespace = namespace;

    if (locales[currentNamespace]?.[context.locale]?.[key] == null) {
      currentNamespace = "_system";
    }

    const tpl = locales[currentNamespace][context.locale][key];
    return tpl.replace(/{{([\s\S]+?)}}/g, (_: string, k: string) => data?.[k.trim()] ?? "");
  };

  return { t };
};

export default withTranslation;
