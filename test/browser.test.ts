import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { renderLbxToSvg } from '../src/browser.js';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'generic-full.lbx');

test('browser renderer: loads in-memory LBX bytes and returns SVG', () => {
  const bytes = new Uint8Array(readFileSync(fixture));
  const svg = renderLbxToSvg(bytes);

  assert.match(svg, /^<svg /);
  assert.match(svg, /<image /);
  assert.match(svg, /Group Label/);
});
