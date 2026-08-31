import type { Document, Element } from '@xmldom/xmldom';
import { LabelObject } from './base.js';
import { NS } from '../xml/namespaces.js';
import { getChildNS } from '../xml/dom.js';
import { formatPt } from '../units.js';
import type { LbxArchive } from '../zip.js';

/** image:image — a raster image object. Reads/writes its backing bytes through the owning archive. */
export class ImageObject extends LabelObject {
  constructor(el: Element, doc: Document, private readonly archive: LbxArchive) {
    super(el, doc);
  }

  private get imageStyleEl(): Element {
    const style = getChildNS(this.el, NS.image, 'imageStyle');
    if (!style) throw new Error('node-lbx: image object is missing image:imageStyle');
    return style;
  }

  get fileName(): string {
    return this.imageStyleEl.getAttribute('fileName') ?? '';
  }

  getImageBuffer(): Buffer {
    return this.archive.readBinary(this.fileName);
  }

  /**
   * Replaces the image bytes, writing them back under the object's existing archive filename.
   * NOTE: image:orgPos is synced to the current objectStyle position/size on write; its exact
   * resize/crop semantics in P-touch Editor are unconfirmed by sample data (see plan open risks).
   */
  setImage(bufferOrPath: Buffer | string, opts: { originalName?: string } = {}): void {
    const buffer = typeof bufferOrPath === 'string' ? this.archive.readExternalFile?.(bufferOrPath) : bufferOrPath;
    if (!buffer) throw new Error('node-lbx: filesystem paths are unavailable in this environment; pass image bytes instead');
    const name = this.fileName;
    if (!name) throw new Error('node-lbx: image object has no fileName to write to');
    this.archive.writeBinary(name, buffer);
    if (opts.originalName !== undefined) this.imageStyleEl.setAttribute('originalName', opts.originalName);

    const orgPos = getChildNS(this.imageStyleEl, NS.image, 'orgPos');
    if (orgPos) {
      orgPos.setAttribute('x', formatPt(this.x));
      orgPos.setAttribute('y', formatPt(this.y));
      orgPos.setAttribute('width', formatPt(this.width));
      orgPos.setAttribute('height', formatPt(this.height));
    }
  }
}
