
import { Component, Fragment, Prop, h } from "@stencil/core";

@Component({
    tag: 'bn-layout',
    styleUrl: 'bn-layout.scss',
    shadow: true
})
export class Layout {
    @Prop()
    layout: 'full' | 'split-vertical' | 'split-horizontal' = 'full'

    private getLayoutStyle() {
        let flexDirection;

        if (this.layout === 'split-vertical') {
            flexDirection = 'column'
        } else if (this.layout === 'split-horizontal') {
            flexDirection = 'row'
        }

        return {
            display: 'flex',
            height: "100%",
            width: "100%",
            flexDirection
        };
    }

    private getSlots() {

        switch (this.layout) {
            case 'full':
                return <slot name='slot-0'></slot>
            case 'split-vertical':
                return <Fragment><slot name='slot-0'></slot><slot name='slot-1'></slot></Fragment>
            case 'split-horizontal':
                return <Fragment><slot name='slot-0'></slot><slot name='slot-1'></slot></Fragment>
            default:
                return <slot name='slot-0'></slot>
        }
    }

    render() {
        return <div style={this.getLayoutStyle()}>
            {this.getSlots()}
        </div>
    }
}