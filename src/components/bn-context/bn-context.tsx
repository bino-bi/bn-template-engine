import { Component, h, Host, Element, Prop, Watch } from "@stencil/core";
import { ScopedStores, getOrCreateStores } from "../../context/context-protocol";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

@Component({
  tag: "bn-context",
  styleUrl: "bn-context.css",
  shadow: true,
})
export class Context {
  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;
  private stores: ScopedStores;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
  }

  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;

  @Prop() locale: string;

  /**
   * Default i18n namespace for every component inside this context.
   * Resolved at runtime from the `i18n-namespace` attribute by the nearest
   * ancestor lookup in `withTranslation`; a namespace set on a page, card,
   * tree, grid, or the component itself wins. Declared so the attribute is
   * part of the typed public API rather than a bare DOM attribute.
   */
  @Prop({ reflect: true, attribute: "i18n-namespace" }) i18nNamespace: string;

  @Watch("locale")
  setLocale(newValue: string) {
    this.stores.context.state.locale = newValue;
  }

  currentPageUpdate = undefined;

  connectedCallback() {
    // Retrieve (or create) the stores for this context element.
    // A descendant component may have already triggered creation via
    // getStores() if Stencil initialized it before this component.
    this.stores = getOrCreateStores(this.element);

    if (this.locale) {
      this.stores.context.state.locale = this.locale;
    }

    this.currentPageUpdate = setTimeout(() => {
      this.element.querySelectorAll("bn-page, bn-layout-page").forEach((page, index) => {
        if (page.localName === "bn-layout-page") {
          page.setAttribute("page-number", (index + 1).toString());
        } else {
          const footer = page.querySelector("bn-footer");
          if (footer) {
            // @ts-ignore
            footer.setAttribute("page-number", (index + 1).toString());
          }
        }
      });
    }, 250);
  }

  disconnectedCallback() {
    if (this.currentPageUpdate) {
      clearTimeout(this.currentPageUpdate);
    }
  }

  componentWillLoad() {
    // stencil needs one componenet implementing all lifecycle steps to get mixing working
  }

  componentDidLoad() {}

  componentShouldUpdate() {}

  componentWillRender() {}

  componentDidRender() {}

  componentWillUpdate() {}

  componentDidUpdate() {}

  render() {
    return (
      <Host>
        <slot />
      </Host>
    );
  }
}
