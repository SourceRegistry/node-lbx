import type { Element } from '@xmldom/xmldom';
import { LabelObject } from './base.js';
import { NS } from '../xml/namespaces.js';
import { getChildNS, getTextContent, setTextContent } from '../xml/dom.js';

/** barcode:barcode — protocol + encoded value live in pt:data / barcode:barcodeStyle. */
export class BarcodeObject extends LabelObject {
  private get dataEl(): Element {
    const el = getChildNS(this.el, NS.pt, 'data');
    if (!el) throw new Error('node-lbx: barcode object is missing pt:data');
    return el;
  }

  private get styleEl(): Element {
    const el = getChildNS(this.el, NS.barcode, 'barcodeStyle');
    if (!el) throw new Error('node-lbx: barcode object is missing barcode:barcodeStyle');
    return el;
  }

  get data(): string {
    return getTextContent(this.dataEl);
  }

  setData(value: string): void {
    setTextContent(this.doc, this.dataEl, value);
  }

  get protocol(): string {
    return this.styleEl.getAttribute('protocol') ?? '';
  }

  set protocol(value: string) {
    this.styleEl.setAttribute('protocol', value);
  }
}
