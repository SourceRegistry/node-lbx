import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPt, formatPt, parsePt, ptToMm } from '../src/units.js';

test('toPt: plain number is treated as points', () => {
  assert.equal(toPt(10), 10);
});

test('toPt: parses "Npt"/"Nmm"/"Nin" strings', () => {
  assert.equal(toPt('12pt'), 12);
  assert.equal(toPt('10mm'), 10 * 2.834645669);
  assert.equal(toPt('1in'), 72);
});

test('toPt: accepts {mm}/{in}/{pt} objects', () => {
  assert.equal(toPt({ pt: 5 }), 5);
  assert.equal(toPt({ in: 1 }), 72);
  assert.ok(Math.abs(toPt({ mm: 25.4 }) - 72) < 1e-6);
});

test('formatPt: strips floating point noise and appends "pt"', () => {
  assert.equal(formatPt(toPt(10)), '10pt');
  assert.equal(formatPt(toPt('11.3pt')), '11.3pt');
});

test('parsePt: reads Brother attribute strings back to Length', () => {
  assert.equal(parsePt('106.8pt'), 106.8);
  assert.equal(parsePt(null), 0);
  assert.equal(parsePt(undefined), 0);
});

test('ptToMm round-trips toPt({mm})', () => {
  assert.ok(Math.abs(ptToMm(toPt({ mm: 12 })) - 12) < 1e-6);
});
