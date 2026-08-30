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
