import type { Document, Element } from '@xmldom/xmldom';
import type { LbxArchive } from '../zip.js';
import { NS } from '../xml/namespaces.js';
import { LabelObject } from './base.js';
import { TextObject, DateTimeObject } from './text.js';
import { ImageObject } from './image.js';
import { BarcodeObject } from './barcode.js';
import { TableObject } from './table.js';
import { GroupObject } from './group.js';

/** Fallback wrapper for object types without a dedicated class yet (draw:*, image:clipart, cable:*). */
export class UnknownObject extends LabelObject {}

/** Dispatches a pt:objects child element to its typed wrapper class by namespace + tag name. */
export function createLabelObject(el: Element, doc: Document, archive: LbxArchive): LabelObject {
  const ns = el.namespaceURI;
  const local = el.localName;

  if (ns === NS.text && local === 'text') return new TextObject(el, doc);
  if (ns === NS.text && local === 'datetime') return new DateTimeObject(el, doc);
  if (ns === NS.image && local === 'image') return new ImageObject(el, doc, archive);
  if (ns === NS.barcode && local === 'barcode') return new BarcodeObject(el, doc);
  if (ns === NS.table && local === 'table') return new TableObject(el, doc, archive);
  if (ns === NS.pt && local === 'group') return new GroupObject(el, doc, archive);

  return new UnknownObject(el, doc);
}
