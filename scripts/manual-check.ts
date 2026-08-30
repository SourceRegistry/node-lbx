/**
 * Generates a few output .lbx files for manual verification in P-touch Editor, from the generic
 * synthetic fixtures (not personal data) — run: npx tsx test/fixtures/generate.ts && npx tsx scripts/manual-check.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LbxDocument } from '../src/document.js';
import { TableObject } from '../src/objects/table.js';
import { BarcodeObject } from '../src/objects/barcode.js';
import { ImageObject } from '../src/objects/image.js';
import { GroupObject } from '../src/objects/group.js';
import { TextObject } from '../src/objects/text.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'manual-check');
const fixture = path.join(root, 'test', 'fixtures', 'generic-full.lbx');

// --- Phase 2/3/4 check: edit text, barcode, table cell, and swap an image on a synthetic template ---
{
  const doc = LbxDocument.load(fixture);

  const barcode = doc.findObjectByName('SAMPLE_BARCODE') as BarcodeObject;
  barcode.setData('9781234567897');

  const table = doc.findObjectByName('SAMPLE_TABLE') as TableObject;
  table.getCell(1, 1)!.textObject!.setText('Updated A');
  table.getCell(1, 2)!.textObject!.setText('Updated B');

  const group = doc.findObjectByName('SAMPLE_GROUP') as GroupObject;
  (group.getObjects().find((o) => o instanceof TextObject) as TextObject).setText('Node-LBX Demo');

  const version = doc.findObjectByName('SAMPLE_VERSION') as TextObject;
  version.setText('V2', { preserveRuns: true });

  // Swap the top-level SAMPLE_IMAGE bytes for the other embedded image's bytes, so the output
  // still contains a valid BMP without needing an external asset.
  const images = doc.findObjectsByName('SAMPLE_IMAGE') as ImageObject[];
  const topImage = images.find((img) => img.fileName === 'sample-top.bmp')!;
  const otherImageBytes = images.find((img) => img.fileName === 'sample-group.bmp')!.getImageBuffer();
  topImage.setImage(otherImageBytes);

  doc.save(path.join(outDir, 'phase2-4-template-fill.lbx'));
  console.log('wrote manual-check/phase2-4-template-fill.lbx');
}

// --- Phase 5 check: a from-scratch label (paper + text + image) ---
{
  const doc = LbxDocument.create({ width: '24mm', height: '60mm', marginLeft: '2pt', marginRight: '2pt' });

  doc.addText({
    x: '4pt',
    y: '4pt',
    width: '150pt',
    height: '20pt',
    text: 'Hello from node-lbx',
    objectName: 'GREETING',
    fontName: 'Helsinki',
    fontSize: '12pt',
  });

  const originalDoc = LbxDocument.load(fixture);
  const iconBytes = (originalDoc.findObjectByName('SAMPLE_IMAGE') as ImageObject).getImageBuffer();
  doc.addImage({
    x: '4pt',
    y: '28pt',
    width: '40pt',
    height: '40pt',
    fileName: 'icon.bmp',
    objectName: 'ICON',
    data: iconBytes,
  });

  doc.save(path.join(outDir, 'phase5-from-scratch.lbx'));
  console.log('wrote manual-check/phase5-from-scratch.lbx');
}
