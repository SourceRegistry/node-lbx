import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { LbxDocument } from '../src/document.js';
import { TextObject, DateTimeObject } from '../src/objects/text.js';
import { ImageObject } from '../src/objects/image.js';
import { BarcodeObject } from '../src/objects/barcode.js';
import { TableObject } from '../src/objects/table.js';
import { GroupObject } from '../src/objects/group.js';
import { diffElements } from './util/xmlStructuralDiff.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');
const FULL = path.join(FIXTURES, 'generic-full.lbx');
const SIMPLE = path.join(FIXTURES, 'generic-simple.lbx');

test('load: walks the richest fixture into the expected typed object graph', () => {
  const doc = LbxDocument.load(FULL);
  const objects = doc.getObjects();

  assert.equal(objects.length, 6, 'expected 6 top-level pt:objects children');
  assert.ok(objects[0] instanceof ImageObject);
  assert.equal(objects[0]!.objectName, 'SAMPLE_IMAGE');
  assert.ok(objects[1] instanceof BarcodeObject);
  assert.equal(objects[1]!.objectName, 'SAMPLE_BARCODE');
  assert.ok(objects[2] instanceof TableObject);
  assert.equal(objects[2]!.objectName, 'SAMPLE_TABLE');
  assert.ok(objects[3] instanceof GroupObject);
  assert.equal(objects[3]!.objectName, 'SAMPLE_GROUP');
  assert.ok(objects[4] instanceof TextObject);
  assert.equal(objects[4]!.objectName, 'SAMPLE_VERSION');
  assert.equal((objects[4] as TextObject).text, 'V1');
  assert.ok(objects[5] instanceof DateTimeObject);
  assert.equal(objects[5]!.objectName, 'SAMPLE_DATETIME');
  assert.equal((objects[5] as DateTimeObject).date, '2025-01-01');
});

test('load: parses the small fixture without error and exposes both its objects', () => {
  const doc = LbxDocument.load(SIMPLE);
  const objects = doc.getObjects();
  assert.equal(objects.length, 2);
  assert.ok(objects[0] instanceof TextObject);
  assert.ok(objects[1] instanceof ImageObject);
});

test('findObjectByName / findObjectsByName: locates top-level and nested (group) placeholders', () => {
  const doc = LbxDocument.load(FULL);

  const barcode = doc.findObjectByName('SAMPLE_BARCODE');
  assert.ok(barcode instanceof BarcodeObject);

  // SAMPLE_IMAGE appears once at top level and once nested inside pt:group -> both must be found
  const images = doc.findObjectsByName('SAMPLE_IMAGE');
  assert.equal(images.length, 2);
  assert.ok(images.every((o) => o instanceof ImageObject));

  assert.equal(doc.findObjectByName('DOES_NOT_EXIST'), undefined);
});

test('round-trip: saving without mutating produces structurally identical label.xml', () => {
  const doc = LbxDocument.load(FULL);
  const outputBuffer = doc.toBuffer();

  const originalXml = new AdmZip(FULL).readAsText('label.xml');
  const outputXml = new AdmZip(outputBuffer).readAsText('label.xml');

  const parser = new DOMParser();
  const originalRoot = parser.parseFromString(originalXml, 'text/xml').documentElement!;
  const outputRoot = parser.parseFromString(outputXml, 'text/xml').documentElement!;

  const diffs = diffElements(originalRoot as never, outputRoot as never);
  assert.deepEqual(diffs, []);
});

test('round-trip: unrelated archive entries (images, prop.xml) survive byte-identical', () => {
  const doc = LbxDocument.load(FULL);
  const outputBuffer = doc.toBuffer();

  const originalZip = new AdmZip(FULL);
  const outputZip = new AdmZip(outputBuffer);

  for (const name of ['sample-top.bmp', 'sample-group.bmp', 'prop.xml']) {
    const originalData = originalZip.readFile(name)!;
    const outputData = outputZip.readFile(name)!;
    assert.ok(originalData.equals(outputData), `${name} changed unexpectedly`);
  }
});

test('TextObject.setText: default collapse keeps charLen consistent with the new string', () => {
  const doc = LbxDocument.load(FULL);
  const table = doc.findObjectByName('SAMPLE_TABLE') as TableObject;
  const cell = table.getCell(1, 1)!;
  const text = cell.textObject!;

  assert.equal(text.text, 'Field A');
  text.setText('Updated A');
  assert.equal(text.text, 'Updated A');

  const runs = text.getRuns();
  const totalCharLen = runs.reduce((sum, r) => sum + r.text.length, 0);
  assert.equal(totalCharLen, 'Updated A'.length);
  assert.equal(runs.map((r) => r.text).join(''), 'Updated A');
});

test('TextObject.setText: preserveRuns rejects a length change', () => {
  const doc = LbxDocument.load(FULL);
  const version = doc.findObjectByName('SAMPLE_VERSION') as TextObject;
  assert.throws(() => version.setText('too long', { preserveRuns: true }));
  version.setText('V2', { preserveRuns: true });
  assert.equal(version.text, 'V2');
});

test('save: writes a loadable .lbx file to disk', async () => {
  const os = await import('node:os');
  const fs = await import('node:fs');
  const doc = LbxDocument.load(FULL);
  const outPath = path.join(os.tmpdir(), `node-lbx-test-${Date.now()}.lbx`);
  doc.save(outPath);

  const reloaded = LbxDocument.load(outPath);
  assert.equal(reloaded.getObjects().length, 6);
  fs.rmSync(outPath);
});
