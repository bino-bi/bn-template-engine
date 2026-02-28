import { Component, Element, h, Host, Prop, State, Watch } from "@stencil/core";
import withDataset from "../../utils/withDataset";
import withTranslation from "../../utils/withTranslation";
import withComponentStatus from "../../utils/withComponentStatus";
import { withStyled } from "../../utils/styled/withStyled";
import withComponentStyle from "../../utils/withComponentStyle";
import withHasError, { ErrorDispatcher } from "../../utils/withHasError";
import { BinoTextStyles } from "../../utils/model/TextStyles";
import { getParentDimensions } from "../../utils/parentDimensions";
import { parseScaling } from "../../utils/scaling";

const ALLOWED_TAGS = new Set([
  "br",
  "b",
  "i",
  "strong",
  "em",
  "span",
  "p",
  "div",
  "table",
  "tr",
  "td",
  "th",
  "thead",
  "tbody",
  "tfoot",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "sub",
  "sup",
  "small",
  "hr",
  "a",
  "img",
]);

const ALLOWED_ATTRS = new Set([
  "class",
  "style",
  "colspan",
  "rowspan",
  "href",
  "title",
  "src",
  "alt",
  "width",
  "height",
]);

const DANGEROUS_PATTERN = /\b(__proto__|globalThis)\b|\.constructor\b/;

function sanitizeHtml(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  sanitizeNode(container);
  return container.innerHTML;
}

function sanitizeNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
      node.replaceChild(document.createTextNode(el.textContent || ""), el);
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
        el.removeAttribute(attr.name);
      } else if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      } else if (name === "style" && /expression|javascript/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    sanitizeNode(el);
  }
}

/**
 * Renders a template-driven text block with dataset interpolation.
 *
 * The `value` prop is evaluated as a JavaScript template literal in a
 * sandboxed scope (`data` and `t` are available) and sanitized against
 * XSS before being injected as HTML. Supports auto-scaling to fit the
 * parent container.
 */
@Component({
  tag: "bn-text",
  styleUrl: "bn-text.scss",
  shadow: true,
})
export class Text {
  // @ts-ignore - Required by mixins (withComponentStatus, withHasError, withComponentStyle)
  @Element() private element: HTMLElement;
  constructor() {
    withStyled(this);
    withComponentStatus(this);
    this.errors = withHasError(this);
    this.t = withTranslation(this).t;
    withDataset(this, (name, data) => {
      this.data = { ...this.data, [name]: data };
    });
    this.componentStyle = withComponentStyle(this);
  }

  /**
   * Template string rendered as HTML. Supports JavaScript template literal
   * syntax — use `${data.<dataset>}` to interpolate dataset values and
   * `${t('<key>')}` for translated strings.
   *
   * The template is evaluated in a sandboxed scope (only `data` and `t` are
   * accessible; globals like `window`/`document` are blocked) and the output
   * is sanitized against XSS (only safe HTML tags and attributes are kept).
   *
   * @example
   * // plain text
   * value="Hello World"
   *
   * // with dataset interpolation
   * value="Revenue: ${data.kpi[0].ac1}"
   *
   * // with translation
   * value="${t('report.title')}"
   *
   * // with HTML formatting
   * value="<b>Total</b>: ${data.kpi[0].ac1}<br>as of today"
   */
  @Prop() value?: string;

  /**
   * Controls font-size scaling relative to the available parent space.
   * Scaling considers both width and height — the tighter constraint wins.
   *
   * | Value          | Behavior                                                       |
   * |----------------|----------------------------------------------------------------|
   * | not set / `""` | Auto-scale to fit, emit `AUTO_scale` warning with applied factor |
   * | `"none"`       | No scaling; emit `WARN_overflow` warning if content overflows  |
   * | `"auto"`       | Auto-scale to fit, silent (no warning)                         |
   * | `"0.5"`, `"1.2"`, … | Apply `baseFontSize × factor`; emit `WARN_overflow` if still overflows |
   *
   * Invalid values (negative, non-numeric, non-keyword) fall back to the
   * default (auto + warning) and emit an `ERR_scale` warning.
   */
  @Prop() scale?: string;

  @State() data: Record<string, unknown> = {};

  private readonly componentStyle: <T>(q: (Style) => T) => T;
  private readonly t: (key: string, data?: object) => string;
  private readonly errors: ErrorDispatcher;

  @Watch("value")
  validateValue(newValue: string) {
    const isBlank = typeof newValue !== "string" || newValue === "";
    if (isBlank) {
      this.errors.addOrReplace({ id: "no_value", type: "warning", message: "Empty value" });
    } else {
      this.errors.remove("no_value");
    }
  }

  @Watch("scale")
  validateScaling(newValue: string) {
    if (newValue == null || newValue === "" || newValue === "none" || newValue === "auto") {
      this.errors.remove("ERR_scale");
      return;
    }
    const num = Number(newValue);
    if (isNaN(num) || num <= 0) {
      this.errors.addOrReplace({
        id: "ERR_scale",
        type: "warning",
        message: `Invalid scale value: "${newValue}". Use "none", "auto", or a positive number.`,
      });
    } else {
      this.errors.remove("ERR_scale");
    }
  }

  componentWillLoad() {
    this.validateValue(this.value);
    this.validateScaling(this.scale);
  }

  private evalTemplate(template: string): string {
    if (!template) return "";
    if (DANGEROUS_PATTERN.test(template)) {
      this.errors.addOrReplace({ id: "ERR_value_eval", type: "error", message: "Template contains forbidden pattern" });
      return "";
    }
    try {
      const scope = { data: this.data, t: this.t };
      const sandbox = new Proxy(scope, {
        has: () => true,
        get: (target, key) => (key === Symbol.unscopables ? undefined : target[key]),
        set: () => true,
      });
      const fn = new Function("sandbox", "with(sandbox){try{return`" + template + '`}catch(e){return""}}');
      const result = fn.call(sandbox, sandbox);
      this.errors.remove("ERR_value_eval");
      return result != null ? String(result) : "";
    } catch (e) {
      this.errors.addOrReplace({
        id: "ERR_value_eval",
        type: "error",
        message: `Template evaluation failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      return "";
    }
  }

  private prepareStyle(): BinoTextStyles {
    return this.componentStyle(($) => ({
      fontStyles: {
        font: `${$["bn-text"]?.["fontSizePx"] ?? $["global"]?.["fontSizePx"] ?? 13.3333}px ${$["bn-text"]?.["fontFamily"] ?? $["global"]?.["fontFamily"] ?? "'Noto Sans', sans-serif"}`,
        size: $["bn-text"]?.["fontSizePx"] ?? $["global"]?.["fontSizePx"] ?? 13.3333,
        color: $["bn-text"]?.["fontColor"] ?? $["global"]?.["fontColor"] ?? "#000000",
        background: $["bn-text"]?.["fontBackgroundColor"] ?? $["global"]?.["fontBackgroundColor"] ?? "#ffffff",
        leading: $["bn-text"]?.["leading"] ?? 1.8,
      },
    }));
  }

  private container!: HTMLSpanElement;

  private applyScaling(baseFontSize: number) {
    const host = this.element;
    const { mode, factor } = parseScaling(this.scale);
    const { width: parentWidth, height: parentHeight } = getParentDimensions(host);

    const hostConstrained = host.scrollHeight > host.clientHeight + 1;
    const availableHeight = hostConstrained ? host.clientHeight : parentHeight;
    const availableWidth = parentWidth;

    const hasWidthOverflow = availableWidth > 0 && host.scrollWidth > availableWidth + 1;
    const hasHeightOverflow = availableHeight > 0 && host.scrollHeight > availableHeight + 1;
    const hasOverflow = hasWidthOverflow || hasHeightOverflow;

    if (availableWidth <= 0 && availableHeight <= 0) return;

    if (mode === "none") {
      if (hasOverflow) {
        const parts = [];
        if (hasWidthOverflow) parts.push(`w:${host.scrollWidth}>${Math.round(availableWidth)}`);
        if (hasHeightOverflow) parts.push(`h:${host.scrollHeight}>${Math.round(availableHeight)}`);
        this.errors.addOrReplace({
          id: "WARN_overflow",
          type: "warning",
          message: `Content overflows container (${parts.join(", ")})`,
        });
      } else {
        this.errors.remove("WARN_overflow");
      }
      return;
    }

    if (mode === "factor") {
      if (hasOverflow) {
        const parts = [];
        if (hasWidthOverflow) parts.push(`w:${host.scrollWidth}>${Math.round(availableWidth)}`);
        if (hasHeightOverflow) parts.push(`h:${host.scrollHeight}>${Math.round(availableHeight)}`);
        this.errors.addOrReplace({
          id: "WARN_overflow",
          type: "warning",
          message: `Content overflows with factor ${factor} (${parts.join(", ")})`,
        });
      } else {
        this.errors.remove("WARN_overflow");
      }
      return;
    }

    // mode === 'empty' or 'auto': measure at base size, then scale down if needed
    host.style.setProperty("--bn-font-size", `${baseFontSize}px`);

    const baseScrollW = host.scrollWidth;
    const baseScrollH = host.scrollHeight;
    const baseClientH = host.clientHeight;
    const baseConstrained = baseScrollH > baseClientH + 1;
    const baseAvailH = baseConstrained ? baseClientH : parentHeight;

    const fitsW = availableWidth <= 0 || baseScrollW <= availableWidth + 1;
    const fitsH = baseAvailH <= 0 || baseScrollH <= baseAvailH + 1;

    if (fitsW && fitsH) {
      this.errors.remove("AUTO_scale");
      return;
    }

    const widthFactor = !fitsW && availableWidth > 0 ? availableWidth / baseScrollW : 1;
    const heightFactor = !fitsH && baseAvailH > 0 ? baseAvailH / baseScrollH : 1;
    const computedFactor = Math.min(1.0, widthFactor, heightFactor);

    host.style.setProperty("--bn-font-size", `${baseFontSize * computedFactor}px`);

    if (mode === "empty") {
      this.errors.addOrReplace({
        id: "AUTO_scale",
        type: "warning",
        message: `Auto-scaled font by factor ${computedFactor.toFixed(3)}`,
      });
    } else {
      this.errors.remove("AUTO_scale");
    }
  }

  componentDidRender() {
    this.container.innerHTML = sanitizeHtml(this.evalTemplate(this.value));
    this.applyScaling(this.prepareStyle().fontStyles.size);
  }

  render() {
    const { fontStyles } = this.prepareStyle();
    const { mode, factor } = parseScaling(this.scale);

    const fontSize = mode === "factor" ? `${fontStyles.size * factor}px` : `${fontStyles.size}px`;

    const cssVars: { [key: string]: string } = {
      "--bn-font-family": fontStyles.font.substring(fontStyles.font.indexOf("px ") + 3),
      "--bn-font-size": fontSize,
      "--bn-font-color": fontStyles.color,
      "--bn-font-background": fontStyles.background,
    };

    return (
      <Host style={cssVars}>
        <div>
          <span
            class="container"
            ref={(el) => {
              this.container = el;
            }}
          ></span>
        </div>
      </Host>
    );
  }
}
