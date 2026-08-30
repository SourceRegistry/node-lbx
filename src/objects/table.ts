import type { Document, Element } from '@xmldom/xmldom';
import { LabelObject } from './base.js';
import { TextObject } from './text.js';
import { NS } from '../xml/namespaces.js';
import { getChildNS, getChildrenNS } from '../xml/dom.js';
import type { LbxArchive } from '../zip.js';
import { createLabelObject } from './factory.js';

const CONTENT_NS = new Set<string>([NS.text, NS.image, NS.barcode, NS.table, NS.draw, NS.pt]);

function findCellContentEl(cellEl: Element): Element | undefined {
  const children = cellEl.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children.item(i);
    if (!node || node.nodeType !== 1) continue;
    const el = node as unknown as Element;
    // skip pt:brush / pt:pen styling children; a cell's content is the one real object it wraps (usually text:text)
    if (el.namespaceURI === NS.pt && (el.localName === 'brush' || el.localName === 'pen')) continue;
    if (CONTENT_NS.has(el.namespaceURI ?? '')) return el;
  }
  return undefined;
}

export class TableCell {
  constructor(
    private readonly el: Element,
    private readonly doc: Document,
    private readonly archive: LbxArchive,
  ) {}

  get element(): Element {
    return this.el;
  }

  get addressX(): number {
    return parseInt(this.el.getAttribute('addressX') ?? '0', 10);
  }
  get addressY(): number {
    return parseInt(this.el.getAttribute('addressY') ?? '0', 10);
  }
  get spanX(): number {
    return parseInt(this.el.getAttribute('spanX') ?? '1', 10);
  }
  get spanY(): number {
    return parseInt(this.el.getAttribute('spanY') ?? '1', 10);
  }

  /** Convenience accessor for the common case of a cell wrapping a single text:text object. */
  get textObject(): TextObject | undefined {
    const content = findCellContentEl(this.el);
    if (!content) return undefined;
    const obj = createLabelObject(content, this.doc, this.archive);
    return obj instanceof TextObject ? obj : undefined;
  }
}

/** table:table — a grid of cells, each optionally wrapping a nested object (usually text:text). */
export class TableObject extends LabelObject {
  constructor(el: Element, doc: Document, private readonly archive: LbxArchive) {
    super(el, doc);
  }

  private get tableStyleEl(): Element {
    const el = getChildNS(this.el, NS.table, 'tableStyle');
    if (!el) throw new Error('node-lbx: table object is missing table:tableStyle');
    return el;
  }

  private get cellsEl(): Element {
    const el = getChildNS(this.el, NS.table, 'cells');
    if (!el) throw new Error('node-lbx: table object is missing table:cells');
    return el;
  }

  get rows(): number {
    return parseInt(this.tableStyleEl.getAttribute('row') ?? '0', 10);
  }

  get columns(): number {
    return parseInt(this.tableStyleEl.getAttribute('column') ?? '0', 10);
  }

  getCells(): TableCell[] {
    return getChildrenNS(this.cellsEl, NS.table, 'cell').map((el) => new TableCell(el, this.doc, this.archive));
  }

  /** 1-based address lookup, matching Brother's addressX/addressY attributes. */
  getCell(x: number, y: number): TableCell | undefined {
    return this.getCells().find((cell) => cell.addressX === x && cell.addressY === y);
  }
}
