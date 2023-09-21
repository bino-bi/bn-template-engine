import { Component, h, Element, Prop, Method, Fragment } from "@stencil/core";

@Component({
    tag: 'bn-layout-page',
    styleUrl: 'bn-layout-page.scss',
    shadow: true
})
export class LayoutPage {
    @Element() el: HTMLElement

    @Prop() styles?: string;

    @Prop() titleBusinessUnit: string = '';
    @Prop() titleScenarios?: string;
    @Prop() titleVariances?: string;
    @Prop() titleOrder: string = 'category';
    @Prop() titleOrderDirection: string = 'asc';
    @Prop() titleMeasures?: string;
    @Prop() titleDateStart?: string;
    @Prop() titleDateEnd?: string;
    @Prop() titleDateFormat: string = 'none';
    @Prop() titleDateLink: string = 'none';
    @Prop() titleNamespace: string = '_system';


    @Prop() pageFormat?: string;
    @Prop() pageOrientation?: string;
    @Prop() pageNumber?: string;

    @Prop() footerText?: string;
    @Prop() footerDisplayPageNumber?: boolean = true;

    @Prop() pageLayout: 'full' | 'split-vertical' | 'split-horizontal' | '2x2' | '3x3' | '4x4' | '1-over-2' | '1-over-3' | '2-over-1' | '3-over-1' | 'custom-template' = 'full'
    @Prop() pageCustomTemplate: string = "\"a b\" \"c d\"";
    @Prop() pageGridGap: string = "0";
    @Prop() pageFitToContent: boolean = true;

    private templateMap = new Map([['split-vertical', "\"a  b\""],
    ['split-horizontal', "\"a\" \"b\""],
    ['2x2', "\"a b\" \"c d\""],
    ['3x3', "\"a b c\" \"d e f\" \"g h i\""],
    ['4x4', "\"a b c d\" \"e f g h\" \"i j k l\""],
    ['1-over-2', "\"a a\" \"b c\""],
    ['2-over-1', "\"a b\" \"c c\""],
    ['1-over-3', "\"a a a \" \"b c d\""],
    ['3-over-1', "\"a b c\" \"d d d\""],
    ['custom-template', "\"a b\" \"c c c\""]
    ]);

    private getCommonStyles() {
        let height = "100%";
        let width = "100%";

        if (this.pageFitToContent === true) {
            width = "fit-content";
            height = "fit-content";
        }

        return {
            display: "grid",
            height: height,
            width: width,
            gap: this.pageGridGap + "px"
        };
    }

    private getLayoutStyle() {
        return {
            ...this.getCommonStyles(),
            "grid-template-areas": this.getTemplatePattern(this.pageLayout),
        };
    }

    private createDivAreaStyles(elements: string[]) {
        return elements.map(x => (
            {
                "overflow": "hidden",
                "grid-area": x,
            }));
    }

    private getSlots(slotNames: string[]) {
        const items = this.createDivAreaStyles(slotNames);

        return <Fragment>
            {items.map((value, index) => {
                return <div style={value}>
                    <slot name={'slot-' + index}></slot>
                </div>
            })}
        </Fragment>
    }

    private extractSlotNames(styleElement: string | null) {
        if (styleElement == null) {
            return [];
        }

        const words = styleElement.match(/\b\w+\b/g);
        if (!words) {
            return [];
        }

        return Array.from(new Set(words));
    }

    private getTemplatePattern(name: string): string {
        console.dir({ name: name })
        if (this.templateMap.has(name) == false && name != 'custom-template') {
            return "\"a\"";
        }

        if (name == 'custom-template') {
            return this.pageCustomTemplate;
        }

        return this.templateMap.get(name);
    }


    @Method()
    async getNumberOfSlot(name: string) {
        let template = this.getTemplatePattern(name);
        return this.extractSlotNames(template).length;
    }

    componentDidUpdate() {
        // workaround for the render rotation issue
        let renderOrientation = this.el.closest('bn-context').getAttribute('render-orientation')
        if (renderOrientation && renderOrientation != this.pageOrientation) {
            const page = this.el.shadowRoot.querySelector('bn-page');
            const layout = this.el.closest('bn-layout-page')
            if (layout && page) {
                page.style.transform = 'rotate(-90deg) translate(-100%)'
                page.style.transformOrigin = 'top left';
                layout.style.width = `${page.clientHeight}px`;
                layout.style.height = `${page.clientWidth}px`;
            }
        }
    }

    render() {
        let style = this.getLayoutStyle();
        let arrOfSlots: string[] = this.extractSlotNames(style["grid-template-areas"]);

        // @ts-ignore
        return <bn-page styles={this.styles} format={this.pageFormat} orientation={this.pageOrientation}>
            <bn-title   // @ts-ignore 
                namespace={this.titleNamespace} business-unit={this.titleBusinessUnit} scenarios={this.titleScenarios} variances={this.titleVariances} order={this.titleOrder} order-direction={this.titleOrderDirection} measures={this.titleMeasures} date-start={this.titleDateStart} date-end={this.titleDateEnd} date-format={this.titleDateFormat} date-link={this.titleDateLink} >
            </bn-title>
            <bn-body>
                <div style={style}>
                    {this.getSlots(arrOfSlots)}
                </div>
            </bn-body>
            <bn-footer text={this.footerText} page-number={this.pageNumber} display-page-number={this.footerDisplayPageNumber}>
            </bn-footer>
        </bn-page>
    }
}

