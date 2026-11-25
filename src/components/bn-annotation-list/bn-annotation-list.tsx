import { Component, Element, forceUpdate, h, Host, Prop } from "@stencil/core";
import { getStores, ScopedStores } from "../../context/context-protocol";
import { annotationColor, annotationPageKey, parseListItems } from "../../utils/annotations";
import { sanitizeHtml } from "../../utils/sanitizeHtml";
import { Style } from "../../stores/componentStyles";
import withComponentStatus from "../../utils/withComponentStatus";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";

/**
 * Prints the numbered texts of the annotations of a page: the number in a
 * circle like the ones on the page (always in the main colour of the style), the bold
 * title, then the text.
 *
 * The numbers are given. An entry without a number has no circle, and neither
 * has an entry whose mark `bn-annotation-layer` could not place on this page.
 * The other entries keep their numbers: the list never counts again.
 *
 * @example
 * <bn-annotation-list items='[{"label":"1","title":"2024 Plan Software","html":"Up by <b>9.1 kEUR</b>."}]'>
 * </bn-annotation-list>
 */
@Component({
  tag: "bn-annotation-list",
  styleUrl: "bn-annotation-list.scss",
  shadow: true,
})
export class AnnotationList {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError)
  @Element() private element: HTMLElement;

  /**
   * JSON array of the entries, each one `{ name?, label?, title?, html? }`. `html` is
   * inline markup and is sanitized before it is inserted. `name` is written to
   * `data-bino-annotation` on the entry.
   */
  @Prop() items?: string;

  /**
   * Name of the component style to use (the `name` of a
   * `<bn-component-style>`). Its section `bn-annotation` sets the colour of the circles.
   */
  @Prop({ reflect: true }) selectedStyle?: string;

  // @ts-ignore - Initialized by withHasError mixin
  private readonly errors: ErrorDispatcher;
  private readonly componentStyle: <T>(q: (style: Style) => T) => T;
  private stores: ScopedStores;
  private pageKey = "";
  private unsubscribe?: () => void;

  constructor() {
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.componentStyle = withComponentStyle(this);
  }

  connectedCallback() {
    this.stores = getStores(this.element);
    this.pageKey = annotationPageKey(this.element);
    this.unsubscribe = this.stores.annotationsUnplaced.on("set", (key) => {
      if (key === this.pageKey) forceUpdate(this.element);
    });
    // back in the document: Stencil does not render again, and the store or the page may have changed
    forceUpdate(this.element);
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  render() {
    const items = parseListItems(this.items);
    if (items) {
      this.errors.remove("ERR_items");
    } else {
      this.errors.addOrReplace({ id: "ERR_items", type: "error", message: "items: not a JSON array of objects." });
    }
    const style = this.componentStyle(($) => $["bn-annotation"]);
    const color = annotationColor(undefined, style);
    const badgeStyle =
      style?.markerStyle === "outlined"
        ? { background: "#ffffff", color, boxShadow: `inset 0 0 0 1.5px ${color}` }
        : { background: color };
    const unplaced = this.stores?.annotationsUnplaced.state[this.pageKey] ?? [];

    return (
      <Host>
        <ol>
          {(items ?? []).map((item) => (
            <li data-bino-annotation={item.name}>
              {item.label != null && !unplaced.includes(item.label) ? (
                <div class="badge" style={badgeStyle}>
                  <span>{item.label}</span>
                </div>
              ) : item.label != null ? (
                // keeps the room of the circle: a list that changes its height can move the marked element, and with it the answer
                <div class="badge-space"></div>
              ) : null}
              <div class="text">
                {item.title ? <span class="title">{item.title} </span> : null}
                {item.html ? <span innerHTML={sanitizeHtml(item.html)}></span> : null}
              </div>
            </li>
          ))}
        </ol>
      </Host>
    );
  }
}
