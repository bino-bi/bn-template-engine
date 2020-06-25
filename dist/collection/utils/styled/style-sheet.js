class StyleSheet {
    constructor() {
        this.cache = new Map();
        this.tag = StyleSheet.makeStyleTag();
    }
    static makeStyleTag() {
        const tag = document.createElement('style');
        tag.type = 'text/css';
        tag.setAttribute('data-bn-computed-style', '');
        tag.append(document.createTextNode(''));
        (document.head || document.querySelector('head')).append(tag);
        return tag;
    }
    apply(data) {
        data.forEach(value => this.cache.set(value.className, value.style));
        this.tag.innerHTML = Array.from(this.cache.values()).map(value => value).join("\n");
    }
}
export const styleSheet = new StyleSheet();
