export const templateId = (elm: HTMLElement) => {
    if(elm.parentElement) {
        const parent = elm.parentElement;
        const id = parent.getAttribute("template-id");
        if(id) {
            return id;
        } else {
            return templateId(parent);
        }
    } else {
        return undefined;
    }
};
