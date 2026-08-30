import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import { writeFileSync } from 'node:fs';
import { openArchive, createArchive, type LbxArchive } from './zip.js';
import { NS } from './xml/namespaces.js';
import { getChildNS, getChildElements } from './xml/dom.js';
import { LabelObject } from './objects/base.js';
import { TextObject } from './objects/text.js';
import { ImageObject } from './objects/image.js';
import { GroupObject } from './objects/group.js';
import { createLabelObject } from './objects/factory.js';
import { LabelMetadata } from './metadata.js';
import { PaperStyle, type PaperOptions } from './style.js';
import { createDocumentSkeleton, createPropSkeleton } from './builder/templates.js';
import { createTextElement, createImageElement, type CreateTextOptions, type CreateImageOptions } from './builder/labelBuilder.js';

const LABEL_XML = 'label.xml';
const PROP_XML = 'prop.xml';

export class LbxDocument {
  // Parsed lazily (only when getMetadata() is called) so that a load->save round-trip that never
  // touches metadata copies the original prop.xml bytes through unchanged, rather than reformatting
  // them via the serializer. See plan decision: save() leaves prop.xml untouched by default.
  private propDoc: Document | undefined;

  private constructor(
    private readonly archive: LbxArchive,
    private readonly labelDoc: Document,
    private readonly hasPropXml: boolean,
  ) {}

  /** Loads an existing .lbx file (path or in-memory buffer). */
  static load(source: string | Buffer): LbxDocument {
    const archive = openArchive(source);
    const labelDoc = new DOMParser().parseFromString(archive.readText(LABEL_XML), 'text/xml') as unknown as Document;
    return new LbxDocument(archive, labelDoc, archive.hasEntry(PROP_XML));
  }

  /** Starts a new label from scratch with the given paper/tape settings. */
  static create(paper: PaperOptions): LbxDocument {
    const archive = createArchive();
    const { document } = createDocumentSkeleton(paper);
    const doc = new LbxDocument(archive, document, true);
    doc.propDoc = createPropSkeleton();
    return doc;
  }

  private get sheetEl(): Element {
    const root = this.labelDoc.documentElement as unknown as Element;
    const body = getChildNS(root, NS.pt, 'body');
    const sheet = body && getChildNS(body, NS.style, 'sheet');
    if (!sheet) throw new Error('node-lbx: label.xml is missing style:sheet');
    return sheet;
  }

  private get objectsEl(): Element {
    const el = getChildNS(this.sheetEl, NS.pt, 'objects');
    if (!el) throw new Error('node-lbx: label.xml is missing pt:objects');
    return el;
  }

  getObjects(): LabelObject[] {
    return getChildElements(this.objectsEl).map((el) => createLabelObject(el, this.labelDoc, this.archive));
  }

  findObjectsByName(name: string): LabelObject[] {
    const result: LabelObject[] = [];
    const visit = (objs: LabelObject[]): void => {
      for (const obj of objs) {
        if (obj.objectName === name) result.push(obj);
        if (obj instanceof GroupObject) visit(obj.getObjects());
      }
    };
    visit(this.getObjects());
    return result;
  }

  findObjectByName(name: string): LabelObject | undefined {
    return this.findObjectsByName(name)[0];
  }

  addObject(obj: LabelObject): void {
    this.objectsEl.appendChild(obj.element);
  }

  removeObject(obj: LabelObject): void {
    this.objectsEl.removeChild(obj.element);
  }

  /** Builder convenience: creates a text object, attaches it, and returns its wrapper. */
  addText(opts: CreateTextOptions): TextObject {
    const el = createTextElement(this.labelDoc, opts);
    this.objectsEl.appendChild(el);
    return new TextObject(el, this.labelDoc);
  }

  /** Builder convenience: writes the image bytes into the archive, creates the object, attaches it. */
  addImage(opts: CreateImageOptions & { data: Buffer }): ImageObject {
    const el = createImageElement(this.labelDoc, opts);
    this.archive.writeBinary(opts.fileName, opts.data);
    this.objectsEl.appendChild(el);
    return new ImageObject(el, this.labelDoc, this.archive);
  }

  getMetadata(): LabelMetadata {
    if (!this.hasPropXml) throw new Error('node-lbx: document has no prop.xml');
    if (!this.propDoc) {
      this.propDoc = new DOMParser().parseFromString(this.archive.readText(PROP_XML), 'text/xml') as unknown as Document;
    }
    return new LabelMetadata(this.propDoc);
  }

  getPaper(): PaperStyle {
    const paperEl = getChildNS(this.sheetEl, NS.style, 'paper');
    if (!paperEl) throw new Error('node-lbx: label.xml is missing style:paper');
    return new PaperStyle(paperEl);
  }

  /** Escape hatch to the underlying label.xml DOM Document for anything not yet modeled. */
  get rawDocument(): Document {
    return this.labelDoc;
  }

  toBuffer(): Buffer {
    const serializer = new XMLSerializer();
    this.archive.writeText(LABEL_XML, serializer.serializeToString(this.labelDoc));
    if (this.propDoc) {
      this.archive.writeText(PROP_XML, serializer.serializeToString(this.propDoc));
    }
    return this.archive.toBuffer();
  }

  save(path: string): void {
    writeFileSync(path, this.toBuffer());
  }
}
