/**
 * Generates generic, synthetic .lbx fixtures for the test suite — safe to commit, no personal data.
 * Run with: npx tsx test/fixtures/generate.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LbxDocument } from '../../src/document.js';
import { getChildNS } from '../../src/xml/dom.js';
import { NS } from '../../src/xml/namespaces.js';
import { createObjectStyleEl } from '../../src/builder/templates.js';
import { createTextElement } from '../../src/builder/labelBuilder.js';
import { createElementNS, setTextContent } from '../../src/xml/dom.js';
import { toPt, formatPt } from '../../src/units.js';
import type { Document, Element } from '@xmldom/xmldom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Minimal valid uncompressed 24-bit BMP, generated in code (no real image asset needed). */
function makeSampleBmp(width: number, height: number, rgb: [number, number, number]): Buffer {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const buf = Buffer.alloc(54 + pixelDataSize);

  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);

  let offset = 54;
  const [r, g, b] = rgb;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buf[offset++] = b;
      buf[offset++] = g;
      buf[offset++] = r;
    }
    offset += rowSize - width * 3;
  }
  return buf;
}

function getObjectsEl(doc: LbxDocument): Element {
  const root = doc.rawDocument.documentElement as unknown as Element;
  const body = getChildNS(root, NS.pt, 'body')!;
  const sheet = getChildNS(body, NS.style, 'sheet')!;
  return getChildNS(sheet, NS.pt, 'objects')!;
}

function buildBarcodeElement(
  document: Document,
  opts: { x: number; y: number; width: number; height: number; data: string; objectName: string },
): Element {
  const el = createElementNS(document, 'barcode', 'barcode');
  el.appendChild(createObjectStyleEl(document, opts));

  const style = createElementNS(document, 'barcode', 'barcodeStyle');
  style.setAttribute('protocol', 'CODE128');
  style.setAttribute('lengths', String(opts.data.length));
  style.setAttribute('zeroFill', 'false');
  style.setAttribute('barWidth', '0.8pt');
  style.setAttribute('barRatio', '1:3');
  style.setAttribute('humanReadable', 'true');
  style.setAttribute('humanReadableAlignment', 'CENTER');
  style.setAttribute('checkDigit', 'true');
  style.setAttribute('autoLengths', 'true');
  style.setAttribute('margin', 'false');
  style.setAttribute('sameLengthBar', 'true');
  style.setAttribute('bearerBar', 'false');
  el.appendChild(style);

  const data = createElementNS(document, 'pt', 'data');
  setTextContent(document, data, opts.data);
  el.appendChild(data);

  return el;
}

interface TableSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  objectName: string;
  rows: (string | undefined)[][];
}

function buildTableElement(document: Document, spec: TableSpec): Element {
  const nRows = spec.rows.length;
  const nCols = spec.rows[0]!.length;

  const el = createElementNS(document, 'table', 'table');
  el.appendChild(createObjectStyleEl(document, spec));

  const tableStyle = createElementNS(document, 'table', 'tableStyle');
  tableStyle.setAttribute('row', String(nRows));
  tableStyle.setAttribute('column', String(nCols));
  tableStyle.setAttribute('autoSize', 'false');
  tableStyle.setAttribute('keepSize', 'true');
  el.appendChild(tableStyle);

  const colWidth = spec.width / nCols;
  const rowHeight = spec.height / nRows;
  const xPositions = Array.from({ length: nCols + 1 }, (_, i) => formatPt(toPt(i * colWidth))).join(' ');
  const yPositions = Array.from({ length: nRows + 1 }, (_, i) => formatPt(toPt(i * rowHeight))).join(' ');
  const gridPos = createElementNS(document, 'table', 'gridPosition');
  gridPos.setAttribute('x', xPositions);
  gridPos.setAttribute('y', yPositions);
  el.appendChild(gridPos);

  const cellsEl = createElementNS(document, 'table', 'cells');
  for (let ry = 0; ry < nRows; ry++) {
    for (let cx = 0; cx < nCols; cx++) {
      const cellEl = createElementNS(document, 'table', 'cell');
      cellEl.setAttribute('addressX', String(cx + 1));
      cellEl.setAttribute('addressY', String(ry + 1));
      cellEl.setAttribute('spanX', '1');
      cellEl.setAttribute('spanY', '1');
      cellEl.setAttribute('backColor', '#FFFFFF');
      cellEl.setAttribute('backPrintColorNumber', '0');

      const value = spec.rows[ry]![cx];
      if (value) {
        const textEl = createTextElement(document, {
          x: spec.x + cx * colWidth + 2,
          y: spec.y + ry * rowHeight + 2,
          width: colWidth - 4,
          height: rowHeight - 4,
          text: value,
        });
        cellEl.appendChild(textEl);
      }

      const brush = createElementNS(document, 'pt', 'brush');
      brush.setAttribute('style', 'NULL');
      brush.setAttribute('color', '#000000');
      brush.setAttribute('printColorNumber', '1');
      brush.setAttribute('id', '0');
      cellEl.appendChild(brush);

      cellsEl.appendChild(cellEl);
    }
  }
  el.appendChild(cellsEl);

  return el;
}

function buildDateTimeElement(
  document: Document,
  opts: { x: number; y: number; width: number; height: number; objectName: string; date: string; hour: number; minute: number },
): Element {
  const el = createElementNS(document, 'text', 'datetime');
  el.appendChild(createObjectStyleEl(document, opts));

  const fontInfo = createElementNS(document, 'text', 'ptFontInfo');
  const logFont = createElementNS(document, 'text', 'logFont');
  logFont.setAttribute('name', 'Helsinki');
  logFont.setAttribute('width', '0');
  logFont.setAttribute('italic', 'false');
  logFont.setAttribute('weight', '400');
  logFont.setAttribute('charSet', '0');
  logFont.setAttribute('pitchAndFamily', '2');
  fontInfo.appendChild(logFont);
  const fontExt = createElementNS(document, 'text', 'fontExt');
  fontExt.setAttribute('effect', 'NOEFFECT');
  fontExt.setAttribute('underline', '0');
  fontExt.setAttribute('strikeout', '0');
  fontExt.setAttribute('size', '6pt');
  fontExt.setAttribute('orgSize', '6pt');
  fontExt.setAttribute('textColor', '#000000');
  fontExt.setAttribute('textPrintColorNumber', '1');
  fontInfo.appendChild(fontExt);
  el.appendChild(fontInfo);

  const style = createElementNS(document, 'text', 'dateTimeStyle');
  style.setAttribute('mode', 'DATE');
  style.setAttribute('format', '7');
  style.setAttribute('horizontalAlignment', 'CENTER');
  style.setAttribute('verticalAlignment', 'CENTER');
  style.setAttribute('fixedFrame', 'true');
  style.setAttribute('aspectNormal', 'true');
  style.setAttribute('charSpace', '0');
  style.setAttribute('orgSize', '6pt');
  style.setAttribute('atPrint', 'true');
  style.setAttribute('vertical', 'false');
  style.setAttribute('addtion', 'false');
  style.setAttribute('units', 'DAYS');
  style.setAttribute('addPeriod', '0');
  el.appendChild(style);

  const dateAndTime = createElementNS(document, 'text', 'dateAndTime');
  dateAndTime.setAttribute('date', opts.date);
  dateAndTime.setAttribute('hour', String(opts.hour));
  dateAndTime.setAttribute('minute', String(opts.minute));
  el.appendChild(dateAndTime);

  return el;
}

// --- generic-simple.lbx: text + image only, built entirely through the public builder API ---
{
  const doc = LbxDocument.create({ width: '24mm', height: '30mm' });
  doc.addText({ x: 4, y: 4, width: 120, height: 16, text: 'Sample Label', objectName: 'SAMPLE_TEXT' });
  doc.addImage({
    x: 4,
    y: 24,
    width: 20,
    height: 20,
    fileName: 'sample.bmp',
    objectName: 'SAMPLE_IMAGE',
    data: makeSampleBmp(20, 20, [80, 140, 220]),
  });
  doc.save(path.join(__dirname, 'generic-simple.lbx'));
  console.log('wrote generic-simple.lbx');
}

// --- generic-full.lbx: image + barcode + table + group(image+text) + text, same shape as a real
// P-touch template, but every value is synthetic placeholder content. ---
{
  const doc = LbxDocument.create({ width: '62mm', height: '100mm', marginLeft: '4pt', marginRight: '4pt' });
  const objectsEl = getObjectsEl(doc);
  const rawDoc = doc.rawDocument;

  // top-level image
  const topImage = doc.addImage({
    x: 10,
    y: 10,
    width: 40,
    height: 40,
    fileName: 'sample-top.bmp',
    objectName: 'SAMPLE_IMAGE',
    data: makeSampleBmp(40, 40, [220, 150, 40]),
  });
  void topImage;

  // barcode
  objectsEl.appendChild(
    buildBarcodeElement(rawDoc, { x: 10, y: 55, width: 80, height: 30, data: '0000000000000', objectName: 'SAMPLE_BARCODE' }),
  );

  // table: 2 columns x 2 rows, left column labels, right column left blank (mirrors real templates
  // where alternating columns are label/value pairs)
  objectsEl.appendChild(
    buildTableElement(rawDoc, {
      x: 10,
      y: 90,
      width: 160,
      height: 40,
      objectName: 'SAMPLE_TABLE',
      rows: [
        ['Field A', undefined],
        ['Field B', undefined],
      ],
    }),
  );

  // group: nested image + text, built via the public API then reparented into the group container
  const groupEl = createElementNS(rawDoc, 'pt', 'group');
  groupEl.appendChild(
    createObjectStyleEl(rawDoc, { x: 180, y: 90, width: 60, height: 20, objectName: 'SAMPLE_GROUP' }),
  );
  const groupObjectsEl = createElementNS(rawDoc, 'pt', 'objects');
  groupEl.appendChild(groupObjectsEl);

  // reuses the SAMPLE_IMAGE objectName (also used by the top-level image above) to exercise the
  // "same placeholder name appears both top-level and nested in a group" scenario.
  const groupImage = doc.addImage({
    x: 180,
    y: 90,
    width: 16,
    height: 16,
    fileName: 'sample-group.bmp',
    objectName: 'SAMPLE_IMAGE',
    data: makeSampleBmp(16, 16, [40, 180, 90]),
  });
  groupImage.element.parentNode!.removeChild(groupImage.element);
  groupObjectsEl.appendChild(groupImage.element);

  const groupText = doc.addText({ x: 198, y: 90, width: 42, height: 20, text: 'Group Label', objectName: 'SAMPLE_GROUP_TEXT' });
  groupText.element.parentNode!.removeChild(groupText.element);
  groupObjectsEl.appendChild(groupText.element);

  objectsEl.appendChild(groupEl);

  // a lone top-level text object, elsewhere on the label
  const cornerText = doc.addText({ x: 200, y: 5, width: 20, height: 10, text: 'V1', objectName: 'SAMPLE_VERSION' });
  cornerText.element.parentNode!.removeChild(cornerText.element);
  objectsEl.appendChild(cornerText.element);

  // a standalone auto date/time field
  objectsEl.appendChild(
    buildDateTimeElement(rawDoc, {
      x: 10,
      y: 135,
      width: 40,
      height: 10,
      objectName: 'SAMPLE_DATETIME',
      date: '2025-01-01',
      hour: 12,
      minute: 0,
    }),
  );

  doc.save(path.join(__dirname, 'generic-full.lbx'));
  console.log('wrote generic-full.lbx');
}
