import type { Element } from '@xmldom/xmldom';
import { LabelObject } from './base.js';
import { NS } from '../xml/namespaces.js';
import { createElementNS, getChildNS, getChildrenNS, getTextContent, removeChildrenNS, setTextContent } from '../xml/dom.js';
import { toPt, formatPt, parsePt, type Length } from '../units.js';

export interface FontInfo {
  name: string;
  size: Length;
  weight: number;
  italic: boolean;
  color: string;
}

export interface TextRun {
  text: string;
  font?: Partial<FontInfo>;
}

function readFontInfo(fontInfoEl: Element | undefined): FontInfo | undefined {
  if (!fontInfoEl) return undefined;
  const logFont = getChildNS(fontInfoEl, NS.text, 'logFont');
  const fontExt = getChildNS(fontInfoEl, NS.text, 'fontExt');
  return {
    name: logFont?.getAttribute('name') ?? '',
    size: parsePt(fontExt?.getAttribute('size')),
    weight: parseInt(logFont?.getAttribute('weight') ?? '400', 10),
    italic: logFont?.getAttribute('italic') === 'true',
    color: fontExt?.getAttribute('textColor') ?? '#000000',
  };
}

function writeFontInfo(fontInfoEl: Element, font: Partial<FontInfo>): void {
  const logFont = getChildNS(fontInfoEl, NS.text, 'logFont');
  const fontExt = getChildNS(fontInfoEl, NS.text, 'fontExt');
  if (logFont) {
    if (font.name !== undefined) logFont.setAttribute('name', font.name);
    if (font.weight !== undefined) logFont.setAttribute('weight', String(font.weight));
    if (font.italic !== undefined) logFont.setAttribute('italic', String(font.italic));
  }
  if (fontExt) {
    if (font.size !== undefined) {
      fontExt.setAttribute('size', formatPt(font.size));
      // orgSize tracks the P-touch "design size" (observed as ~3.6x the rendered pt size); keep it in step.
      fontExt.setAttribute('orgSize', formatPt(toPt(font.size * 3.6)));
    }
    if (font.color !== undefined) fontExt.setAttribute('textColor', font.color);
  }
}

/** text:text — the primary label text object. */
export class TextObject extends LabelObject {
  private get dataEl(): Element {
    const data = getChildNS(this.el, NS.pt, 'data');
    if (!data) throw new Error('node-lbx: text object is missing pt:data');
    return data;
  }

  private get objectFontInfoEl(): Element | undefined {
    return getChildNS(this.el, NS.text, 'ptFontInfo');
  }

  get text(): string {
    return getTextContent(this.dataEl);
  }

  /**
   * Sets the object's text. By default collapses all runs into a single stringItem spanning the
   * whole string (reusing the first existing run's font), which is the safe default for simple
   * data-fill use cases. Pass `preserveRuns: true` when the new value has the same length as the
   * current text and per-run formatting should be kept untouched.
   */
  setText(value: string, opts: { preserveRuns?: boolean } = {}): void {
    if (opts.preserveRuns) {
      const currentLen = this.text.length;
      if (value.length !== currentLen) {
        throw new Error(
          `node-lbx: setText({ preserveRuns: true }) requires the new text to have the same length as the current text (got ${value.length}, expected ${currentLen}); use setRuns() to change formatting boundaries explicitly`,
        );
      }
      setTextContent(this.doc, this.dataEl, value);
      return;
    }

    const existingRuns = getChildrenNS(this.el, NS.text, 'stringItem');
    const fontTemplate = existingRuns.length > 0 ? getChildNS(existingRuns[0]!, NS.text, 'ptFontInfo') : this.objectFontInfoEl;

    setTextContent(this.doc, this.dataEl, value);
    removeChildrenNS(this.el, NS.text, 'stringItem');

    const run = createElementNS(this.doc, 'text', 'stringItem');
    run.setAttribute('charLen', String(value.length));
    if (fontTemplate) run.appendChild(fontTemplate.cloneNode(true));
    this.el.appendChild(run);
  }

  /** Reads the current run breakdown (text + font per run), reconstructed from stringItem charLen offsets. */
  getRuns(): TextRun[] {
    const full = this.text;
    const runs: TextRun[] = [];
    let offset = 0;
    for (const runEl of getChildrenNS(this.el, NS.text, 'stringItem')) {
      const charLen = parseInt(runEl.getAttribute('charLen') ?? '0', 10);
      const text = full.slice(offset, offset + charLen);
      offset += charLen;
      const font = readFontInfo(getChildNS(runEl, NS.text, 'ptFontInfo'));
      runs.push(font ? { text, font } : { text });
    }
    return runs;
  }

  /** Replaces the text and run/formatting boundaries explicitly. Concatenated run text becomes the new pt:data value. */
  setRuns(runs: TextRun[]): void {
    const fullText = runs.map((r) => r.text).join('');
    setTextContent(this.doc, this.dataEl, fullText);
    removeChildrenNS(this.el, NS.text, 'stringItem');

    const defaultFontInfo = this.objectFontInfoEl;
    for (const run of runs) {
      const runEl = createElementNS(this.doc, 'text', 'stringItem');
      runEl.setAttribute('charLen', String(run.text.length));
      if (defaultFontInfo) {
        const fontEl = defaultFontInfo.cloneNode(true) as Element;
        if (run.font) writeFontInfo(fontEl, run.font);
        runEl.appendChild(fontEl);
      }
      this.el.appendChild(runEl);
    }
  }

  get font(): FontInfo | undefined {
    return readFontInfo(this.objectFontInfoEl);
  }

  set font(value: Partial<FontInfo>) {
    const fontInfo = this.objectFontInfoEl;
    if (!fontInfo) throw new Error('node-lbx: text object is missing text:ptFontInfo');
    writeFontInfo(fontInfo, value);
  }
}

/** text:datetime — an auto-inserted date/time stamp object. */
export class DateTimeObject extends LabelObject {
  private get dateTimeEl(): Element {
    const el = getChildNS(this.el, NS.text, 'dateAndTime');
    if (!el) throw new Error('node-lbx: datetime object is missing text:dateAndTime');
    return el;
  }

  get date(): string {
    return this.dateTimeEl.getAttribute('date') ?? '';
  }
  set date(value: string) {
    this.dateTimeEl.setAttribute('date', value);
  }
}
