import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { LbxDocument } from '../src/document.js';
import { ImageObject } from '../src/objects/image.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FULL = path.join(__dirname, 'fixtures', 'generic-full.lbx');

test('ImageObject.getImageBuffer: reads the referenced archive entry', () => {
  const doc = LbxDocument.load(FULL);
  const image = doc.findObjectByName('SAMPLE_IMAGE') as ImageObject;
  assert.equal(image.fileName, 'sample-top.bmp');

  const original = new AdmZip(FULL).readFile('sample-top.bmp')!;
  assert.ok(image.getImageBuffer().equals(original));
});

test('ImageObject.setImage: replaces bytes under the same filename, leaves other entries untouched', () => {
  const doc = LbxDocument.load(FULL);
  const image = doc.findObjectByName('SAMPLE_IMAGE') as ImageObject;
  const replacement = Buffer.from('fake-bmp-bytes-for-testing');

  image.setImage(replacement, { originalName: 'replacement.bmp' });
  assert.ok(image.getImageBuffer().equals(replacement));

  const outputZip = new AdmZip(doc.toBuffer());
  assert.ok(outputZip.readFile('sample-top.bmp')!.equals(replacement));

  const originalZip = new AdmZip(FULL);
  assert.ok(outputZip.readFile('sample-group.bmp')!.equals(originalZip.readFile('sample-group.bmp')!));
  assert.ok(outputZip.readFile('prop.xml')!.equals(originalZip.readFile('prop.xml')!));
});

test('ImageObject.setImage: syncs image:orgPos to the current objectStyle position/size', () => {
  const doc = LbxDocument.load(FULL);
  const image = doc.findObjectByName('SAMPLE_IMAGE') as ImageObject;

  image.width = '50pt';
  image.height = '50pt';
  image.setImage(Buffer.from('x'));

  const orgPos = image.element.getElementsByTagNameNS(
    'http://schemas.brother.info/ptouch/2007/lbx/image',
    'orgPos',
  ).item(0)!;
  assert.equal(orgPos.getAttribute('width'), '50pt');
  assert.equal(orgPos.getAttribute('height'), '50pt');
});
