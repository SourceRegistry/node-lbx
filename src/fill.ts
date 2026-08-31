import { readFileSync } from 'node:fs';
import type { LbxDocument } from './document.js';
import { TextObject } from './objects/text.js';
import { BarcodeObject } from './objects/barcode.js';
import { ImageObject } from './objects/image.js';

export type FillValue = string | Buffer;
export type FillData = Record<string, FillValue>;

/**
 * Fills named placeholder objects (same lookup as `findObjectsByName`, so nested `pt:group`
 * members and repeated names are all filled). Text and barcode objects take a string value; image
 * objects take a Buffer or a filesystem path string to read. Keys with no matching object, and
 * matched objects of an unsupported type, are silently skipped.
 */
export function fillPlaceholders(doc: LbxDocument, data: FillData): void {
  for (const [name, value] of Object.entries(data)) {
    for (const obj of doc.findObjectsByName(name)) {
      if (obj instanceof TextObject) {
        obj.setText(String(value));
      } else if (obj instanceof BarcodeObject) {
        obj.setData(String(value));
      } else if (obj instanceof ImageObject) {
        obj.setImage(Buffer.isBuffer(value) ? value : readFileSync(value));
      }
    }
  }
}
