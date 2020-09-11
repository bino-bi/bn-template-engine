import { r as registerInstance, h, e as Host } from './index-6253379c.js';

const bnPageCss = "bn-page{background:white;height:768px;width:1024px;display:flex;flex-direction:column;page-break-after:always}bn-page[format=xga]{height:768px;width:1024px}bn-page[format=xga][orientation=portrait]{height:1024px;width:768px}bn-page[format=xga][orientation=landscape]{height:768px;width:1024px}bn-page[format=hd]{height:720px;width:1280px}bn-page[format=hd][orientation=portrait]{height:1280px;width:720px}bn-page[format=hd][orientation=landscape]{height:720px;width:1280px}bn-page[format=full-hd]{height:1080px;width:1920px}bn-page[format=full-hd][orientation=portrait]{height:1920px;width:1080px}bn-page[format=full-hd][orientation=landscape]{height:1080px;width:1920px}bn-page[format=\"4k\"]{height:2160px;width:3840px}bn-page[format=\"4k\"][orientation=portrait]{height:3840px;width:2160px}bn-page[format=\"4k\"][orientation=landscape]{height:2160px;width:3840px}bn-page[format=\"4k2k\"]{height:2160px;width:4096px}bn-page[format=\"4k2k\"][orientation=portrait]{height:4096px;width:2160px}bn-page[format=\"4k2k\"][orientation=landscape]{height:2160px;width:4096px}bn-page[format=a4]{height:29.7cm;width:21cm}bn-page[format=a4][orientation=portrait]{height:29.7cm;width:21cm}bn-page[format=a4][orientation=landscape]{height:21cm;width:29.7cm}bn-page[format=a3]{height:42cm;width:29.7cm}bn-page[format=a3][orientation=portrait]{height:42cm;width:29.7cm}bn-page[format=a3][orientation=landscape]{height:29.7cm;width:42cm}bn-page[format=a2]{height:59.4cm;width:42cm}bn-page[format=a2][orientation=portrait]{height:59.4cm;width:42cm}bn-page[format=a2][orientation=landscape]{height:42cm;width:59.4cm}bn-page[format=a1]{height:84.1cm;width:59.4cm}bn-page[format=a1][orientation=portrait]{height:84.1cm;width:59.4cm}bn-page[format=a1][orientation=landscape]{height:59.4cm;width:84.1cm}bn-page[format=a0]{height:118.9cm;width:84.1cm}bn-page[format=a0][orientation=portrait]{height:118.9cm;width:84.1cm}bn-page[format=a0][orientation=landscape]{height:84.1cm;width:118.9cm}bn-page[format=letter]{height:27.9cm;width:21.6cm}bn-page[format=letter][orientation=portrait]{height:27.9cm;width:21.6cm}bn-page[format=letter][orientation=landscape]{height:21.6cm;width:27.9cm}bn-page[format=legal]{height:36.6cm;width:21.6cm}bn-page[format=legal][orientation=portrait]{height:36.6cm;width:21.6cm}bn-page[format=legal][orientation=landscape]{height:21.6cm;width:36.6cm}";

const Template = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
    }
    // @ts-ignore
    validateFormat(newValue, oldValue) {
        //TODO: add validation
    }
    // @ts-ignore
    validateOrientation(newValue, oldValue) {
        //TODO: add validation
    }
    render() {
        return h(Host, null);
    }
    static get watchers() { return {
        "format": ["validateFormat", "validateOrientation"]
    }; }
};
Template.style = bnPageCss;

export { Template as bn_page };
