import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LbxDocument } from '../src/document.js';
import { GroupObject } from '../src/objects/group.js';
import { ImageObject } from '../src/objects/image.js';
import { TextObject } from '../src/objects/text.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FULL = path.join(__dirname, 'fixtures', 'generic-full.lbx');

test('GroupObject: nested pt:objects returns typed children (image + text)', () => {
  const doc = LbxDocument.load(FULL);
  const group = doc.findObjectByName('SAMPLE_GROUP') as GroupObject;

  const children = group.getObjects();
  assert.equal(children.length, 2);
  assert.ok(children[0] instanceof ImageObject);
  assert.equal((children[0] as ImageObject).fileName, 'sample-group.bmp');
  assert.ok(children[1] instanceof TextObject);
  assert.equal((children[1] as TextObject).text, 'Group Label');
  assert.equal(children[1]!.objectName, 'SAMPLE_GROUP_TEXT');
});

test('GroupObject: findObjectByName searches within the group', () => {
  const doc = LbxDocument.load(FULL);
  const group = doc.findObjectByName('SAMPLE_GROUP') as GroupObject;

  const groupText = group.findObjectByName('SAMPLE_GROUP_TEXT');
  assert.ok(groupText instanceof TextObject);
  assert.equal(group.findObjectByName('DOES_NOT_EXIST'), undefined);
});

test('LbxDocument.findObjectsByName recurses into groups (top-level and nested SAMPLE_IMAGE)', () => {
  const doc = LbxDocument.load(FULL);
  const images = doc.findObjectsByName('SAMPLE_IMAGE');
  const fileNames = images.map((o) => (o as ImageObject).fileName).sort();
  assert.deepEqual(fileNames, ['sample-group.bmp', 'sample-top.bmp']);
});
