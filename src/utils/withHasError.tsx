import { getElement } from "@stencil/core";
import { nanoid } from "nanoid";
import { ref, runIfExisits } from "./utils";

export interface ErrorItem {
    id?: string;
    type: 'error' | 'warning';
    message: string;
}

export interface ErrorDispatcher {
    clear: () => void;
    replace: (errors: ErrorItem[]) => void;
    add: (error: ErrorItem) => string;
    remove: (id: string) => void;
}

const withHasError = (component: any) => {

    var { set, modify } = ref<ErrorItem[]>([], items => {
        const elm = getElement(component);
        if (items.length == 0) {
            elm.removeAttribute("has-error");
        } else {
            elm.setAttribute("has-error", JSON.stringify(items));
        }
    })

    const connectedCallback = component['connectedCallback'];
    component['connectedCallback'] = () => {
        runIfExisits(connectedCallback, component);
    }

    const disconnectedCallback = component['disconnectedCallback'];
    component['disconnectedCallback'] = () => {
        runIfExisits(disconnectedCallback, component);
    }

    return {
        clear: () => {
            set([])
        },
        replace: (errors: ErrorItem[]) => {
            set(errors.map(item => {
                if (!item.id) {
                    item.id = nanoid()
                }
                return item;
            }))
        },
        add: (error: ErrorItem) => {
            if (!error.id) error.id = nanoid()
            modify(current => ([...current, error]))
            return error.id
        },
        remove: (id: string) => {
            modify(current => (current.filter(item => (item.id !== id))))
        }
    } as ErrorDispatcher
}

export default withHasError;