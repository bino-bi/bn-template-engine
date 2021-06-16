export const templateId = (elm: HTMLElement) => {
  //TODO: maybte elm.closets  is the better choice!?!?
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
