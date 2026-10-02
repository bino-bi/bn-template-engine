import { Component, h, Host, Element, Method, Prop, Watch } from "@stencil/core";
import { ScopedStores, getOrCreateStores } from "../../context/context-protocol";
import {
  ComponentLayoutState,
  LAYOUT_STATE_VERSION,
  LayoutState,
  LayoutStateOptions,
  Origins,
  assignIds,
  buildGenericState,
  resolveOwnIdentity,
  toLayoutRect,
} from "../../utils/layoutState";
import withComponentStatus from "../../utils/withComponentStatus";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

/** Host element of a visual descendant, possibly exposing its own layout-state method. */
interface LayoutHostElement extends HTMLElement {
  componentOnReady?: () => Promise<unknown>;
  getLayoutState?: (options?: LayoutStateOptions) => Promise<ComponentLayoutState>;
}

/** Every visual bn-* component; non-visual producers (bn-dataset, ...) are excluded. */
const VISUAL_SELECTOR =
  "bn-body, bn-card, bn-chart-bubble, bn-chart-bullet, bn-chart-scatter, " +
  "bn-chart-structure, bn-chart-time, bn-footer, bn-grid, bn-image, " +
  "bn-layout-card, bn-layout-page, bn-message, bn-page, bn-table, " +
  "bn-template, bn-text, bn-title, bn-tree";

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

  /**
   * Lazily generates a JSON-serializable snapshot of the rendered report:
   * every visual descendant with its position and size (context- and
   * component-relative, CSS px), render metadata, diagnostics and - with
   * `detail: "full"` - per-element geometry (bars, labels, axes, cells).
   *
   * Nothing is tracked during rendering; each call measures the DOM at that
   * moment. Call it after the report has settled (e.g. when
   * `window.componentRegisterIsRenderedResult` is true) for final geometry.
   *
   * @param options - `{ detail: "summary" | "full" }`, default `"summary"`
   */
  @Method()
  async getLayoutState(options?: LayoutStateOptions): Promise<LayoutState> {
    const detail = options?.detail ?? "summary";
    const hosts = Array.from(this.element.querySelectorAll<HTMLElement>(VISUAL_SELECTOR));

    await Promise.all(hosts.map((el) => (el as LayoutHostElement).componentOnReady?.() ?? Promise.resolve()));

    const contextRect = this.element.getBoundingClientRect();
    const contextOrigin = { x: contextRect.left, y: contextRect.top };

    const components = await Promise.all(
      hosts.map(async (el): Promise<ComponentLayoutState> => {
        const hostRect = el.getBoundingClientRect();
        const origins: Origins = { context: contextOrigin, component: { x: hostRect.left, y: hostRect.top } };
        try {
          const rich = el as LayoutHostElement;
          if (typeof rich.getLayoutState === "function") {
            return await rich.getLayoutState({ detail });
          }
          return buildGenericState(el, origins);
        } catch (e) {
          let fallback: ComponentLayoutState;
          try {
            fallback = buildGenericState(el, origins);
          } catch {
            const zero = { x: 0, y: 0, width: 0, height: 0 };
            fallback = {
              version: LAYOUT_STATE_VERSION,
              tag: el.localName,
              id: el.localName,
              rect: { context: { ...zero }, component: { ...zero } },
              em: { fontSizePx: 0, appliedScaleFactor: 1 },
              regions: [],
              metadata: {},
              diagnostics: [],
            };
          }
          fallback.error = String(e instanceof Error ? e.message : e);
          return fallback;
        }
      }),
    );

    const ids = assignIds(hosts.map((el) => ({ tag: el.localName, explicitId: resolveOwnIdentity(el) })));
    components.forEach((state, index) => {
      state.id = ids[index];
    });

    return {
      version: LAYOUT_STATE_VERSION,
      generatedAt: new Date().toISOString(),
      detail,
      context: {
        viewport: toLayoutRect(contextRect),
        locale: this.stores?.context.state.locale,
      },
      components,
    };
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
