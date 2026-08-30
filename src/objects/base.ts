import type { Document, Element } from '@xmldom/xmldom';
import { NS } from '../xml/namespaces.js';
import { getChildNS } from '../xml/dom.js';
import { toPt, formatPt, parsePt, type Length, type LengthInput } from '../units.js';

/** Base wrapper for every pt:objects child (text/image/barcode/table/group/...). Wraps a live DOM element in place. */
export abstract class LabelObject {
  constructor(
    protected readonly el: Element,
    protected readonly doc: Document,
  ) {}

  /** Escape hatch to the underlying DOM node for anything not yet modeled by a typed wrapper. */
  get element(): Element {
    return this.el;
  }

  protected get objectStyleEl(): Element {
    const style = getChildNS(this.el, NS.pt, 'objectStyle');
    if (!style) throw new Error(`node-lbx: <${this.el.tagName}> is missing pt:objectStyle`);
    return style;
  }

  protected get expandedEl(): Element | undefined {
    return getChildNS(this.objectStyleEl, NS.pt, 'expanded');
  }

  get objectName(): string {
    return this.expandedEl?.getAttribute('objectName') ?? '';
  }

  set objectName(value: string) {
    const expanded = this.expandedEl;
    if (!expanded) throw new Error('node-lbx: object has no pt:expanded element to set objectName on');
    expanded.setAttribute('objectName', value);
  }

  get id(): string {
    return this.expandedEl?.getAttribute('ID') ?? '';
  }

  get x(): Length {
    return parsePt(this.objectStyleEl.getAttribute('x'));
  }
  set x(value: LengthInput) {
    this.objectStyleEl.setAttribute('x', formatPt(toPt(value)));
  }

  get y(): Length {
    return parsePt(this.objectStyleEl.getAttribute('y'));
  }
  set y(value: LengthInput) {
    this.objectStyleEl.setAttribute('y', formatPt(toPt(value)));
  }

  get width(): Length {
    return parsePt(this.objectStyleEl.getAttribute('width'));
  }
  set width(value: LengthInput) {
    this.objectStyleEl.setAttribute('width', formatPt(toPt(value)));
  }

  get height(): Length {
    return parsePt(this.objectStyleEl.getAttribute('height'));
  }
  set height(value: LengthInput) {
    this.objectStyleEl.setAttribute('height', formatPt(toPt(value)));
  }

  get angle(): number {
    return parseFloat(this.objectStyleEl.getAttribute('angle') ?? '0');
  }
  set angle(value: number) {
    this.objectStyleEl.setAttribute('angle', String(value));
  }
}
