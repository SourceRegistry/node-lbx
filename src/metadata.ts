import type { Document, Element } from '@xmldom/xmldom';
import { NS } from './xml/namespaces.js';
import { getChildNS, getTextContent, setTextContent } from './xml/dom.js';

/** prop.xml wrapper. Never mutated automatically by LbxDocument.save() — edits are opt-in via these setters. */
export class LabelMetadata {
  constructor(private readonly doc: Document) {}

  private get root(): Element {
    return this.doc.documentElement as unknown as Element;
  }

  private field(ns: string, local: string): string {
    const el = getChildNS(this.root, ns, local);
    return el ? getTextContent(el) : '';
  }

  private setField(ns: string, local: string, value: string): void {
    const el = getChildNS(this.root, ns, local);
    if (!el) throw new Error(`node-lbx: prop.xml is missing expected element {${ns}}${local}`);
    setTextContent(this.doc, el, value);
  }

  get title(): string {
    return this.field(NS.dc, 'title');
  }
  set title(value: string) {
    this.setField(NS.dc, 'title', value);
  }

  get subject(): string {
    return this.field(NS.dc, 'subject');
  }
  set subject(value: string) {
    this.setField(NS.dc, 'subject', value);
  }

  get creator(): string {
    return this.field(NS.dc, 'creator');
  }
  set creator(value: string) {
    this.setField(NS.dc, 'creator', value);
  }

  get description(): string {
    return this.field(NS.dc, 'description');
  }
  set description(value: string) {
    this.setField(NS.dc, 'description', value);
  }

  get created(): string {
    return this.field(NS.dcterms, 'created');
  }
  set created(value: string) {
    this.setField(NS.dcterms, 'created', value);
  }

  get modified(): string {
    return this.field(NS.dcterms, 'modified');
  }
  set modified(value: string) {
    this.setField(NS.dcterms, 'modified', value);
  }

  get revision(): number {
    return parseInt(this.field(NS.meta, 'revision') || '0', 10);
  }
  set revision(value: number) {
    this.setField(NS.meta, 'revision', String(value));
  }
}
