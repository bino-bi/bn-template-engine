import {createStore} from "@stencil/store";
import flattenObject from "../utils/flattenObject";

//TODO: add default translation for components (jens)
const de = flattenObject({
  "bn-title": {
    "name": "Sven ist toell!"
  }
})

const en = flattenObject({

})

const {state, on, get, set} = createStore({de, en});

export {on, get, set};
export default state;
