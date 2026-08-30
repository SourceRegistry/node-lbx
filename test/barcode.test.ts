import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LbxDocument } from '../src/document.js';
import { BarcodeObject } from '../src/objects/barcode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FULL = path.join(__dirname, 'fixtures', 'generic-full.lbx');

test('BarcodeObject: reads protocol and data, setData updates pt:data only', () => {
  const doc = LbxDocument.load(FULL);
  const barcode = doc.findObjectByName('SAMPLE_BARCODE') as BarcodeObject;

  assert.equal(barcode.protocol, 'CODE128');
  assert.equal(barcode.data, '0000000000000');

  barcode.setData('9781234567897');
  assert.equal(barcode.data, '9781234567897');
  assert.equal(barcode.protocol, 'CODE128', 'setData must not touch barcodeStyle');
});
