import { h } from "@stencil/core";
import { createProviderConsumer } from '@stencil/state-tunnel';
export default createProviderConsumer({
    isPreview: false,
    dataSources: {}
}, (subscribe, child) => (h("context-consumer", { subscribe: subscribe, renderer: child })));
