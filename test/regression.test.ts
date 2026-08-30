import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { LbxDocument } from '../src/document.js';
import { diffElements } from './util/xmlStructuralDiff.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

// Sweeps every real-world sample label, not just the ones used during development, to catch
// structural variety (different object mixes, sizes) that the dev fixtures didn't exercise.
const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.lbx'));

for (const fixture of fixtures) {
  test(`round-trip regression: ${fixture} is unchanged after a no-op load/save`, () => {
    const fixturePath = path.join(FIXTURES, fixture);
    const doc = LbxDocument.load(fixturePath);
    const outputBuffer = doc.toBuffer();

    const originalXml = new AdmZip(fixturePath).readAsText('label.xml');
    const outputXml = new AdmZip(outputBuffer).readAsText('label.xml');

    const parser = new DOMParser();
    const originalRoot = parser.parseFromString(originalXml, 'text/xml').documentElement!;
    const outputRoot = parser.parseFromString(outputXml, 'text/xml').documentElement!;

    const diffs = diffElements(originalRoot as never, outputRoot as never);
    assert.deepEqual(diffs, []);
  });
}
