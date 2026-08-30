import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LbxDocument } from '../src/document.js';
import { TableObject } from '../src/objects/table.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FULL = path.join(__dirname, 'fixtures', 'generic-full.lbx');

test('TableObject: rows/columns and cell content by 1-based address', () => {
  const doc = LbxDocument.load(FULL);
  const table = doc.findObjectByName('SAMPLE_TABLE') as TableObject;

  assert.equal(table.rows, 2);
  assert.equal(table.columns, 2);

  assert.equal(table.getCell(1, 1)!.textObject!.text, 'Field A');
  assert.equal(table.getCell(1, 2)!.textObject!.text, 'Field B');

  // second column in this fixture is intentionally empty placeholder cells
  assert.equal(table.getCell(2, 1)!.textObject, undefined);
  assert.equal(table.getCell(2, 2)!.textObject, undefined);

  assert.equal(table.getCell(9, 9), undefined, 'out-of-range address returns undefined');
});

test('TableObject: editing a cell text object mutates only that cell', () => {
  const doc = LbxDocument.load(FULL);
  const table = doc.findObjectByName('SAMPLE_TABLE') as TableObject;

  table.getCell(1, 1)!.textObject!.setText('Updated A');
  assert.equal(table.getCell(1, 1)!.textObject!.text, 'Updated A');
  assert.equal(table.getCell(1, 2)!.textObject!.text, 'Field B', 'sibling cell must be untouched');
});
