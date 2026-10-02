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
import { sanitizeHtml } from "../../utils/sanitizeHtml";
import { renderTemplate } from "./utils/template";

/**
 * Renders a text block from a template with dataset and translation
 * placeholders.
 *
 * The `value` prop is markup with `${...}` placeholders. Placeholders are
 * looked up, never evaluated. Resolved values are HTML-escaped and the
 * result is sanitized before it is inserted. Supports auto-scaling to fit
 * the parent container.
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
   * Template string rendered as HTML. These placeholders are replaced:
   * `${data.<dataset>[<row>].<field>}`, `${data['<name>'][<row>].<field>}`
   * (for names such as the datasource reference `$revenue`), `${t('<key>')}`
   * and `${t('<key>', { <name>: <text, number or data path> })}`. Any other
   * text, including any other `${...}`, is printed as written. Nothing is
   * evaluated.
   *
   * Resolved values are HTML-escaped, so dataset values and translations are
   * shown as text. Markup written in the template is kept if it is on the
   * allowlist; other elements are removed with their content. A placeholder
   * that does not resolve renders empty and adds a `WARN_value_path` warning.
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
   * Scaling considers both width and height - the tighter constraint wins.
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
    const { html, unknown } = renderTemplate(this.value ?? "", this.data, this.t);
    if (unknown.length > 0) {
      this.errors.addOrReplace({
        id: "WARN_value_path",
        type: "warning",
        message: `Unknown template path: ${unknown.join(", ")}`,
      });
    } else {
      this.errors.remove("WARN_value_path");
    }
    this.container.innerHTML = sanitizeHtml(html);
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
