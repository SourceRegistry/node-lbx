import type { Document, Element } from '@xmldom/xmldom';
import { LabelObject } from './base.js';
import { NS } from '../xml/namespaces.js';
import { getChildNS, getChildElements } from '../xml/dom.js';
import type { LbxArchive } from '../zip.js';
import { createLabelObject } from './factory.js';

/** pt:group — a composite object nesting its own pt:objects list. */
export class GroupObject extends LabelObject {
  constructor(el: Element, doc: Document, private readonly archive: LbxArchive) {
    super(el, doc);
  }

  private get objectsEl(): Element {
    const el = getChildNS(this.el, NS.pt, 'objects');
    if (!el) throw new Error('node-lbx: group object is missing pt:objects');
    return el;
  }

  getObjects(): LabelObject[] {
    return getChildElements(this.objectsEl).map((el) => createLabelObject(el, this.doc, this.archive));
  }

  findObjectByName(name: string): LabelObject | undefined {
    for (const obj of this.getObjects()) {
      if (obj.objectName === name) return obj;
      if (obj instanceof GroupObject) {
        const found = obj.findObjectByName(name);
        if (found) return found;
      }
    }
    return undefined;
  }
}
