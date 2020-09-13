import { createStore } from "@stencil/store";

const { get, set , onChange} = createStore<any>({
    test: {a: 1, b:2}
});

export {get, set, onChange };