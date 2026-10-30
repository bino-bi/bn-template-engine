import { Component, h, Host, Element, Method, Prop, Watch, forceUpdate } from "@stencil/core";
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
import { pageRule } from "../bn-page/pageFormats";

/** Host element of a visual descendant, possibly exposing its own layout-state method. */
interface LayoutHostElement extends HTMLElement {
  componentOnReady?: () => Promise<unknown>;
  getLayoutState?: (options?: LayoutStateOptions) => Promise<ComponentLayoutState>;
}

/** Attributes that change the paper size, the orientation or the number of a page. */
const PAGE_ATTRIBUTES = [
  "format",
  "orientation",
  "page-format",
  "page-orientation",
  "render-orientation",
  // also watched: a tool that updates the DOM in place may remove the number this context wrote
  "page-number",
];

/**
 * A value of a page. An upgraded element mirrors its attributes in its
 * properties, and a page can be configured through properties alone, so the
 * property is what counts there: a cleared property is no value, whatever
 * the attribute still says. An element without the property has the attribute.
 */
const read = (element: Element, property: string, attribute: string): string | null => {
  const value = (element as unknown as Record<string, unknown>)[property];
  if (typeof value === "string") return value;
  return property in element ? null : element.getAttribute(attribute);
};

/** Every visual bn-* component; non-visual producers (bn-dataset, ...) are excluded. */
const VISUAL_SELECTOR =
  "bn-annotation-layer, bn-annotation-list, bn-body, bn-card, bn-chart-bubble, bn-chart-bullet, bn-chart-scatter, " +
  "bn-chart-structure, bn-chart-time, bn-footer, bn-grid, bn-image, " +
  "bn-layout-card, bn-layout-page, bn-message, bn-page, bn-table, " +
  "bn-text, bn-title, bn-tree";

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

  /**
   * Orientation of the sheets the document is printed on: `landscape` or
   * `portrait`. A `<bn-layout-page>` with the other orientation is turned
   * onto the sheet. Without it no page is turned.
   */
  @Prop({ reflect: true, attribute: "render-orientation" }) renderOrientation?: "landscape" | "portrait";

  @Watch("locale")
  setLocale(newValue: string) {
    this.stores.context.state.locale = newValue;
  }

  /** The page numbers this context wrote. A number that is not in here was set by the author and is left alone. */
  private readonly assignedPageNumbers = new WeakMap<Element, string>();
  private pageObserver: MutationObserver | undefined;
  private pageSizeStyle: HTMLStyleElement | undefined;
  private lastRenderOrientation: string | null | undefined;

  connectedCallback() {
    // Retrieve (or create) the stores for this context element.
    // A descendant component may have already triggered creation via
    // getStores() if Stencil initialized it before this component.
    this.stores = getOrCreateStores(this.element);

    if (this.locale) {
      this.stores.context.state.locale = this.locale;
    }

    this.syncPages();
    // pages that come, go or change their format later
    this.pageObserver = new MutationObserver(() => this.syncPages());
    this.pageObserver.observe(this.element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: PAGE_ATTRIBUTES,
    });
  }

  disconnectedCallback() {
    this.pageObserver?.disconnect();
    this.pageSizeStyle?.remove();
    this.pageSizeStyle = undefined;
  }

  /** Numbers the pages and writes the paper size of the document. */
  private syncPages(): void {
    const pages = Array.from(this.element.querySelectorAll("bn-page, bn-layout-page"));

    pages.forEach((page, index) => {
      // a layout page shows the number itself, a plain page in its footer
      const target = page.localName === "bn-layout-page" ? page : page.querySelector("bn-footer");
      if (!target) return;
      const current = read(target, "pageNumber", "page-number");
      if (current !== null && current !== this.assignedPageNumbers.get(target)) return;
      const number = (index + 1).toString();
      this.assignedPageNumbers.set(target, number);
      if (current !== number) target.setAttribute("page-number", number);
    });

    const renderOrientation = this.element.getAttribute("render-orientation");
    if (this.lastRenderOrientation !== undefined && this.lastRenderOrientation !== renderOrientation) {
      // a layout page reads the attribute while it renders
      pages.filter((page) => page.localName === "bn-layout-page").forEach((page) => forceUpdate(page));
    }
    this.lastRenderOrientation = renderOrientation;

    this.writePageSize(pages[0], renderOrientation);
  }

  /**
   * Writes the `@page` rule: the size the first page is drawn in, turned or
   * not. It has to be a rule of the document, a stylesheet in a shadow root
   * cannot set it.
   */
  private writePageSize(firstPage: Element | undefined, renderOrientation: string | null): void {
    // a document has one paper size: the first context sets it
    if (!firstPage || document.querySelector("bn-context") !== this.element) {
      this.pageSizeStyle?.remove();
      this.pageSizeStyle = undefined;
      return;
    }

    const layoutPage = firstPage.localName === "bn-layout-page";
    const rule = layoutPage
      ? pageRule(
          read(firstPage, "pageFormat", "page-format"),
          read(firstPage, "pageOrientation", "page-orientation"),
          renderOrientation,
        )
      : // a plain bn-page is never turned
        pageRule(read(firstPage, "format", "format"), read(firstPage, "orientation", "orientation"));
    if (!this.pageSizeStyle) {
      this.pageSizeStyle = document.createElement("style");
      this.pageSizeStyle.setAttribute("data-bn-page-size", "");
      document.head.append(this.pageSizeStyle);
    }
    if (this.pageSizeStyle.textContent !== rule) this.pageSizeStyle.textContent = rule;
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
