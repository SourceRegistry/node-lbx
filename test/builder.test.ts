import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LbxDocument } from '../src/document.js';
import { TextObject } from '../src/objects/text.js';
import { ImageObject } from '../src/objects/image.js';

test('LbxDocument.create: builds a minimal from-scratch label with paper settings', () => {
  const doc = LbxDocument.create({ width: '24mm', height: '100mm' });
  const paper = doc.getPaper();
  assert.ok(Math.abs(paper.width - 24 * 2.834645669) < 1e-3);
  assert.equal(paper.orientation, 'landscape');
});

test('from-scratch text + image round-trips through toBuffer -> load with matching values', () => {
  const doc = LbxDocument.create({ width: '24mm', height: '50mm' });

  const text = doc.addText({ x: 5, y: 5, width: 80, height: 20, text: 'Hello node-lbx', objectName: 'GREETING' });
  const image = doc.addImage({
    x: 5,
    y: 30,
    width: 20,
    height: 20,
    fileName: 'logo.bmp',
    objectName: 'LOGO',
    data: Buffer.from('fake-bmp-bytes'),
  });

  assert.equal(text.text, 'Hello node-lbx');
  assert.equal(image.fileName, 'logo.bmp');

  const buffer = doc.toBuffer();
  const reloaded = LbxDocument.load(buffer);
  const objects = reloaded.getObjects();

  assert.equal(objects.length, 2);
  const reloadedText = reloaded.findObjectByName('GREETING') as TextObject;
  const reloadedImage = reloaded.findObjectByName('LOGO') as ImageObject;

  assert.equal(reloadedText.text, 'Hello node-lbx');
  assert.equal(reloadedImage.fileName, 'logo.bmp');
  assert.ok(reloadedImage.getImageBuffer().equals(Buffer.from('fake-bmp-bytes')));
});
