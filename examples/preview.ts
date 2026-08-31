/**
 * Renders an .lbx file to a standalone HTML preview and opens it in the default browser.
 * Optionally fills named placeholders first, so you can preview the *filled* label, not just the
 * empty template.
 *
 * Usage: npx tsx examples/preview.ts <file.lbx> [output.html] [--data data.json] [--no-open]
 *
 * data.json maps objectName -> value:
 *   { "PRODUCT_NAME": "Widget", "PRODUCT_BARCODE": "9781234567897", "PRODUCT_IMAGE": "./photo.png" }
 * Text/barcode objects take the string directly; image objects take a path to read bytes from.
 */
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { LbxDocument } from '../src/document.js';
import { renderToSvg } from '../src/render/svg.js';
import { fillPlaceholders, type FillData } from '../src/fill.js';

const rawArgs = process.argv.slice(2);
const noOpen = rawArgs.includes('--no-open');

const dataIdx = rawArgs.indexOf('--data');
const dataPath = dataIdx !== -1 ? rawArgs[dataIdx + 1] : undefined;
if (dataIdx !== -1 && !dataPath) {
  console.error('--data requires a path to a JSON file');
  process.exit(1);
}

const positional = rawArgs.filter((arg, i) => arg !== '--no-open' && !(dataIdx !== -1 && (i === dataIdx || i === dataIdx + 1)));
const input = positional[0];

if (!input) {
  console.error('Usage: npx tsx examples/preview.ts <file.lbx> [output.html] [--data data.json] [--no-open]');
  process.exit(1);
}

const outPath = positional[1] ?? path.join(path.dirname(input), `${path.basename(input, '.lbx')}.preview.html`);

const doc = LbxDocument.load(input);

if (dataPath) {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8')) as FillData;
  fillPlaceholders(doc, data);
}

const svg = renderToSvg(doc, { padding: 8 });

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${path.basename(input)} — lbx preview</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #2b2b2b; font-family: system-ui, sans-serif; }
  .card { background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,0.4); border-radius: 4px; padding: 12px; }
  .card svg { display: block; max-width: 90vw; max-height: 85vh; }
  .caption { color: #aaa; text-align: center; margin-top: 10px; font-size: 13px; }
</style>
</head>
<body>
  <div>
    <div class="card">${svg}</div>
    <div class="caption">${path.basename(input)}${dataPath ? ` — filled from ${path.basename(dataPath)}` : ''} — layout preview (barcodes shown schematically, not scannable)</div>
  </div>
</body>
</html>
`;

writeFileSync(outPath, html);
console.log(`wrote ${outPath}`);

if (!noOpen) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execFile(opener, [outPath], (err) => {
    if (err) console.error(`could not auto-open (${opener} failed); open ${outPath} manually`);
  });
}
