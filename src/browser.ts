import { DOMParser } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import { strFromU8, unzipSync } from 'fflate';
import { renderToSvg, type RenderOptions } from './render/svg.js';
import { createLabelObject } from './objects/factory.js';
import type { LabelObject } from './objects/base.js';
import { PaperStyle } from './style.js';
import { getChildElements, getChildNS } from './xml/dom.js';
import { NS } from './xml/namespaces.js';
import type { LbxArchive } from './zip.js';
import type { LbxDocument } from './document.js';

const LABEL_XML = 'label.xml';

class BrowserArchive implements LbxArchive {
  private readonly entries: Record<string, Uint8Array>;

  constructor(source: ArrayBuffer | Uint8Array) {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    this.entries = unzipSync(bytes);
  }

  listEntries(): string[] {
    return Object.keys(this.entries);
  }

  hasEntry(name: string): boolean {
    return this.entries[name] !== undefined;
  }

  readText(name: string): string {
    return strFromU8(this.readBinary(name));
  }

  readBinary(name: string): Buffer {
    const bytes = this.entries[name];
    if (!bytes) throw new Error(`node-lbx: archive entry "${name}" not found`);
    // Buffer is a Uint8Array subclass. Renderer code only relies on that shared byte surface.
    return bytes as Buffer;
  }

  writeText(): void {
    throw new Error('node-lbx: the browser renderer opens archives read-only');
  }

  writeBinary(): void {
    throw new Error('node-lbx: the browser renderer opens archives read-only');
  }

  toBuffer(): Buffer {
    throw new Error('node-lbx: the browser renderer opens archives read-only');
  }
}

/** Minimal document model needed by renderToSvg, deliberately free of filesystem APIs. */
class BrowserRenderDocument {
  private readonly archive: BrowserArchive;
  private readonly labelDoc: Document;

  constructor(source: ArrayBuffer | Uint8Array) {
    this.archive = new BrowserArchive(source);
    this.labelDoc = new DOMParser().parseFromString(this.archive.readText(LABEL_XML), 'text/xml') as unknown as Document;
  }

  private get sheetEl(): Element {
    const root = this.labelDoc.documentElement as unknown as Element;
    const body = getChildNS(root, NS.pt, 'body');
    const sheet = body && getChildNS(body, NS.style, 'sheet');
    if (!sheet) throw new Error('node-lbx: label.xml is missing style:sheet');
    return sheet;
  }

  getObjects(): LabelObject[] {
    const objects = getChildNS(this.sheetEl, NS.pt, 'objects');
    if (!objects) throw new Error('node-lbx: label.xml is missing pt:objects');
    return getChildElements(objects).map((element) => createLabelObject(element, this.labelDoc, this.archive));
  }

  getPaper(): PaperStyle {
    const paper = getChildNS(this.sheetEl, NS.style, 'paper');
    if (!paper) throw new Error('node-lbx: label.xml is missing style:paper');
    return new PaperStyle(paper);
  }
}

/**
 * Parses in-memory .lbx bytes and renders the label entirely in the browser.
 * Pass `await file.arrayBuffer()` for a File selected by the user.
 */
export function renderLbxToSvg(source: ArrayBuffer | Uint8Array, opts: RenderOptions = {}): string {
  const document = new BrowserRenderDocument(source);
  return renderToSvg(document as unknown as LbxDocument, opts);
}

export type { RenderOptions };
