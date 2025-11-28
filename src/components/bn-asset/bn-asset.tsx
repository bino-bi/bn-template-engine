import { Component, Prop, h, Host } from '@stencil/core';
import withComponentStatus from '../../utils/withComponentStatus';
import { set } from '../../stores/assets';
import withBodyObserver from '../../utils/withBodyObserver';

@Component({
    tag: 'bn-asset',
    styleUrl: 'bn-asset.css',
})
export class Asset {
    /**
     * Unique (template scope) name of the asset
     */
    @Prop() name!: string;

    constructor() {
        withComponentStatus(this);
        withBodyObserver(this, (data => {
            try {
                const cleanData = data.replace(/\s/g, '');
                // Using the bino cli also a path must be valid
                // if (!cleanData.startsWith("data:")) {
                //     throw new Error("Invalid data url");
                // }
                set(this.name, cleanData);
            } catch (e) {
                console.error("Error parsing asset", e, data);
                // @ts-ignore
                set(this.name, undefined);
            }
        }));
    }

    render() {
        return <Host />;
    }
}