import type { Element } from '@xmldom/xmldom';
import { toPt, formatPt, parsePt, type Length, type LengthInput } from './units.js';

export interface PaperOptions {
  width: LengthInput;
  height: LengthInput;
  marginLeft?: LengthInput;
  marginTop?: LengthInput;
  marginRight?: LengthInput;
  marginBottom?: LengthInput;
  orientation?: 'portrait' | 'landscape';
  autoLength?: boolean;
}

/** style:paper wrapper — the label's tape size / page settings. */
export class PaperStyle {
  constructor(private readonly el: Element) {}

  get width(): Length {
    return parsePt(this.el.getAttribute('width'));
  }
  set width(value: LengthInput) {
    this.el.setAttribute('width', formatPt(toPt(value)));
  }

  get height(): Length {
    return parsePt(this.el.getAttribute('height'));
  }
  set height(value: LengthInput) {
    this.el.setAttribute('height', formatPt(toPt(value)));
  }

  get marginLeft(): Length {
    return parsePt(this.el.getAttribute('marginLeft'));
  }
  set marginLeft(value: LengthInput) {
    this.el.setAttribute('marginLeft', formatPt(toPt(value)));
  }

  get marginTop(): Length {
    return parsePt(this.el.getAttribute('marginTop'));
  }
  set marginTop(value: LengthInput) {
    this.el.setAttribute('marginTop', formatPt(toPt(value)));
  }

  get marginRight(): Length {
    return parsePt(this.el.getAttribute('marginRight'));
  }
  set marginRight(value: LengthInput) {
    this.el.setAttribute('marginRight', formatPt(toPt(value)));
  }

  get marginBottom(): Length {
    return parsePt(this.el.getAttribute('marginBottom'));
  }
  set marginBottom(value: LengthInput) {
    this.el.setAttribute('marginBottom', formatPt(toPt(value)));
  }

  get orientation(): string {
    return this.el.getAttribute('orientation') ?? 'landscape';
  }
  set orientation(value: string) {
    this.el.setAttribute('orientation', value);
  }

  get autoLength(): boolean {
    return this.el.getAttribute('autoLength') === 'true';
  }
  set autoLength(value: boolean) {
    this.el.setAttribute('autoLength', String(value));
  }
}
