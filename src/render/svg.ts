import type { Element } from '@xmldom/xmldom';
import type { LbxDocument } from '../document.js';
import { LabelObject } from '../objects/base.js';
import { TextObject, DateTimeObject } from '../objects/text.js';
import { ImageObject } from '../objects/image.js';
import { BarcodeObject } from '../objects/barcode.js';
import { TableObject } from '../objects/table.js';
import { GroupObject } from '../objects/group.js';
import { NS } from '../xml/namespaces.js';
import { getChildNS } from '../xml/dom.js';
import { bmpToPng } from './bmp.js';
import { encodeCode128B, encodeGS1_128 } from './code128.js';
import { encodeCode39 } from './code39.js';
import { encodeCodabar } from './codabar.js';
import { encodeITF } from './itf.js';
import { encodeEAN13, encodeEAN8, encodeUPCA, encodeUPCE, encodeEAN2, encodeEAN5 } from './eanUpc.js';
import { encodePostnet } from './postnet.js';
import { encodeGs1DataBar } from './gs1DataBar.js';
import { encodeImb } from './imb.js';
import { encodeMaxicode } from './maxicode.js';
import { encodeQr } from './qrcode.js';
import { encodeDataMatrix } from './dataMatrix.js';
import { encodePdf417 } from './pdf417.js';
import { bytesToBase64 } from './bytes.js';

export interface RenderOptions {
  /** Extra white margin (in pt) drawn around the paper bounds. Default 0. */
  padding?: number;
}

interface RenderFont {
  name: string;
  size: number;
  weight: number;
  italic: boolean;
  color: string;
}

interface TextAlignment {
  h: string;
  v: string;
}

const FALLBACK_FONT = 'sans-serif';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mimeForFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function rotateTransform(obj: LabelObject): string {
  if (!obj.angle) return '';
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  return ` transform="rotate(${obj.angle} ${cx} ${cy})"`;
}

function textAlignOf(el: Element): TextAlignment {
  const align = getChildNS(el, NS.text, 'textAlign');
  return {
    h: align?.getAttribute('horizontalAlignment') ?? 'LEFT',
    v: align?.getAttribute('verticalAlignment') ?? 'TOP',
  };
}

/** Lays out (possibly multi-line) text inside a box, matching P-touch's TOP/CENTER/BOTTOM + LEFT/CENTER/RIGHT alignment. */
function renderTextBlock(x: number, y: number, width: number, height: number, lines: string[], font: RenderFont | undefined, align: TextAlignment): string {
  const size = font?.size ?? 10;
  const lineHeight = size * 1.2;
  const totalHeight = lineHeight * lines.length;

  let startY: number;
  if (align.v === 'CENTER') startY = y + (height - totalHeight) / 2;
  else if (align.v === 'BOTTOM') startY = y + height - totalHeight;
  else startY = y;

  const anchor = align.h === 'CENTER' ? 'middle' : align.h === 'RIGHT' ? 'end' : 'start';
  const tx = align.h === 'CENTER' ? x + width / 2 : align.h === 'RIGHT' ? x + width : x;

  const weight = font && font.weight >= 600 ? 'bold' : 'normal';
  const style = font?.italic ? 'italic' : 'normal';
  const fill = font?.color ?? '#000000';
  const fam = font?.name ? esc(font.name) : FALLBACK_FONT;

  const tspans = lines
    .map((line, i) => `<tspan x="${tx}" y="${startY + lineHeight * (i + 1) - lineHeight * 0.2}">${esc(line) || ' '}</tspan>`)
    .join('');

  return `<text font-family="${fam}, ${FALLBACK_FONT}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${fill}" text-anchor="${anchor}">${tspans}</text>`;
}

function renderText(obj: TextObject): string {
  const lines = obj.text.split(/\r\n|\r|\n/);
  const align = textAlignOf(obj.element);
  return `<g${rotateTransform(obj)}>${renderTextBlock(obj.x, obj.y, obj.width, obj.height, lines, obj.font, align)}</g>`;
}

function renderDateTime(obj: DateTimeObject): string {
  const el = obj.element;
  const styleEl = getChildNS(el, NS.text, 'dateTimeStyle');
  const align: TextAlignment = {
    h: styleEl?.getAttribute('horizontalAlignment') ?? 'LEFT',
    v: styleEl?.getAttribute('verticalAlignment') ?? 'TOP',
  };
  const fontInfoEl = getChildNS(el, NS.text, 'ptFontInfo');
  const logFont = fontInfoEl && getChildNS(fontInfoEl, NS.text, 'logFont');
  const fontExt = fontInfoEl && getChildNS(fontInfoEl, NS.text, 'fontExt');
  const font: RenderFont = {
    name: logFont?.getAttribute('name') ?? '',
    size: parseFloat(fontExt?.getAttribute('size') ?? '10'),
    weight: parseInt(logFont?.getAttribute('weight') ?? '400', 10),
    italic: logFont?.getAttribute('italic') === 'true',
    color: fontExt?.getAttribute('textColor') ?? '#000000',
  };
  return `<g${rotateTransform(obj)}>${renderTextBlock(obj.x, obj.y, obj.width, obj.height, [obj.date], font, align)}</g>`;
}

function renderImage(obj: ImageObject): string {
  let dataUri = '';
  try {
    const buf = obj.getImageBuffer();
    let mime = mimeForFileName(obj.fileName);
    let bytes: Uint8Array = buf;
    if (mime === 'image/bmp') {
      // P-touch's 32bpp BMP export hides an alpha channel in a byte the BMP spec (and browsers)
      // treat as opaque padding — re-encode as PNG so transparency renders like P-touch Editor.
      const png = bmpToPng(buf);
      if (png) {
        mime = 'image/png';
        bytes = png;
      }
    }
    dataUri = `data:${mime};base64,${bytesToBase64(bytes)}`;
  } catch {
    // embedded bytes missing from the archive — fall through to the placeholder box below
  }

  const frame = `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="none" stroke="#999" stroke-width="0.5" stroke-dasharray="2,1"/>`;
  if (!dataUri) {
    const label = renderTextBlock(
      obj.x,
      obj.y,
      obj.width,
      obj.height,
      [obj.fileName || 'image'],
      { name: '', size: Math.min(8, obj.height / 2), weight: 400, italic: false, color: '#999' },
      { h: 'CENTER', v: 'CENTER' },
    );
    return `<g${rotateTransform(obj)}>${frame}${label}</g>`;
  }
  return `<g${rotateTransform(obj)}><image x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" preserveAspectRatio="none" href="${dataUri}"/>${frame}</g>`;
}

/** Real, scannable Code 128 bars (Set B), scaled to fill `width` with a quiet zone on each side. */
function widthsToBits(widths: number[]): string {
  let bits = '';
  let isBar = true;
  for (const w of widths) {
    bits += (isBar ? '1' : '0').repeat(w);
    isBar = !isBar;
  }
  return bits;
}

/** Renders a module bit string ('1' = black module, '0' = white module) scaled to fill `width`, with a quiet zone on each side. Consecutive equal bits merge into one rect. */
function renderModuleBits(bits: string, width: number, height: number, quietModules = 10): string {
  const totalModules = bits.length + quietModules * 2;
  const scale = width / totalModules;

  let bars = '';
  let cursor = quietModules * scale;
  let i = 0;
  while (i < bits.length) {
    let j = i;
    while (j < bits.length && bits[j] === bits[i]) j++;
    if (bits[i] === '1') bars += `<rect x="${cursor.toFixed(2)}" y="0" width="${((j - i) * scale).toFixed(2)}" height="${height}" fill="#000"/>`;
    cursor += (j - i) * scale;
    i = j;
  }
  return bars;
}

/** Normalizes a barcodeStyle `protocol` attribute for matching (case/punctuation-insensitive — P-touch's exact spelling per protocol isn't independently documented). */
function protocolKey(protocol: string): string {
  return protocol.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Encodes `data` for a known-real protocol into a module bit string; returns undefined for anything unimplemented or that fails to encode (bad checksum, unsupported characters, etc). */
function encodeLinearBarcode(protocol: string, data: string, checksum: boolean): string | undefined {
  try {
    switch (protocolKey(protocol)) {
      case 'CODE128':
        return widthsToBits(encodeCode128B(data));
      case 'CODE39':
        return encodeCode39(data, { checksum });
      case 'CODABAR':
      case 'NW7':
      case 'NW8':
        return encodeCodabar(data);
      case 'ITF':
      case 'ITF25':
      case 'I25':
      case 'INTERLEAVED25':
      case 'ITFI25':
        return encodeITF(data);
      case 'EAN13':
      case 'JAN13':
        return encodeEAN13(data);
      case 'EAN8':
      case 'JAN8':
        return encodeEAN8(data);
      case 'UPCA':
        return encodeUPCA(data);
      case 'UPCE':
        return encodeUPCE(data);
      case 'UCCEAN128':
      case 'UCCEAN128GS1129':
      case 'GS1128':
      case 'EAN128':
      case 'UCC128':
        return widthsToBits(encodeGS1_128(data));
      case 'GS2DATABARRSS':
      case 'GS1DATABARRSS':
      case 'GS1DATABAR':
      case 'DATABAR':
      case 'RSS':
      case 'RSS14':
        return encodeGs1DataBar(data);
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/** Deterministic bar pattern from the encoded value — reads as "a barcode is here", not a scannable one. Fallback for protocols without a real encoder yet. */
function fakeBarcodeBars(data: string, width: number, height: number): string {
  let seed = 0;
  for (let i = 0; i < data.length; i++) seed = (seed * 31 + data.charCodeAt(i)) >>> 0;
  if (seed === 0) seed = 1;

  let bars = '';
  let cursor = 0;
  let barIndex = 0;
  while (cursor < width) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const barWidth = 0.6 + (seed % 100) / 100;
    if (barIndex % 2 === 0) {
      bars += `<rect x="${cursor.toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height}" fill="#000"/>`;
    }
    cursor += barWidth;
    barIndex++;
  }
  return bars;
}

/** POSTNET's bars are uniform width but vary in height (tall/short), all bottom-aligned — a different visual model from every other linear symbology here, so it gets its own renderer. */
function renderPostnetBars(pattern: string, width: number, height: number): string {
  const quietModules = 2;
  const totalModules = pattern.length + quietModules * 2;
  const scale = width / totalModules;
  const barWidth = scale * 0.6;

  let bars = '';
  for (let i = 0; i < pattern.length; i++) {
    const barHeight = pattern[i] === 'T' ? height : height * 0.45;
    const x = (quietModules + i) * scale;
    bars += `<rect x="${x.toFixed(2)}" y="${(height - barHeight).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" fill="#000"/>`;
  }
  return bars;
}

/** IMb's 65 bars are uniform width but each is one of four vertical placements (F/A/D/T) rather than varying width or height alone — its own visual model again. */
function renderImbBars(pattern: string, width: number, height: number): string {
  const quietModules = 2;
  const totalModules = pattern.length * 2 + quietModules * 2;
  const scale = width / totalModules;
  const barWidth = scale * 0.8;

  const ascenderTop = 0;
  const trackerTop = height * 0.35;
  const trackerBottom = height * 0.65;
  const descenderBottom = height;

  let bars = '';
  for (let i = 0; i < pattern.length; i++) {
    const state = pattern[i];
    const top = state === 'F' || state === 'A' ? ascenderTop : trackerTop;
    const bottom = state === 'F' || state === 'D' ? descenderBottom : trackerBottom;
    const x = (quietModules + i * 2) * scale;
    bars += `<rect x="${x.toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${(bottom - top).toFixed(2)}" fill="#000"/>`;
  }
  return bars;
}

/**
 * Renders a 2D matrix code (dark/light module grid) stretched to fill the object's box, with a
 * quiet-zone margin on each side. Independent x/y scaling (rather than a centered square) so
 * naturally non-square grids like PDF417's (many columns, few rows) fill a wide box properly;
 * for square grids like QR/Data Matrix this is equivalent to a centered square as long as the
 * object's own box is roughly square, which is how P-touch places these objects in practice.
 */
function renderMatrixBarcode(matrix: boolean[][], width: number, height: number): string {
  const rows = matrix.length;
  const cols = matrix[0]!.length;
  const quietModules = 4;
  const scaleX = width / (cols + quietModules * 2);
  const scaleY = height / (rows + quietModules * 2);
  const offsetX = quietModules * scaleX;
  const offsetY = quietModules * scaleY;

  let cells = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r]![c]) {
        cells += `<rect x="${(offsetX + c * scaleX).toFixed(2)}" y="${(offsetY + r * scaleY).toFixed(2)}" width="${scaleX.toFixed(2)}" height="${scaleY.toFixed(2)}" fill="#000"/>`;
      }
    }
  }
  return cells;
}

/**
 * MaxiCode's 33x30 module grid is packed hexagonally (alternating rows offset by half a module,
 * rows spaced closer together than columns) around a fixed bullseye finder, not a square raster —
 * a fourth distinct visual model. The codeword-level encoding is verified (see maxicode.ts), but
 * this hex layout's exact proportions are not independently confirmed against a real scanner.
 */
function renderMaxicodeGrid(grid: boolean[][], width: number, height: number): string {
  const rows = 33;
  const cols = 30;
  const quietModules = 2;
  const rowRatio = 0.866; // cos(30deg): hex row spacing relative to column spacing
  const totalW = cols + quietModules * 2;
  const totalH = rows * rowRatio + quietModules * 2;
  const scale = Math.min(width / totalW, height / totalH);
  const colSpacing = scale;
  const rowSpacing = scale * rowRatio;
  const dotRadius = scale * 0.42;
  const offsetX = (width - cols * colSpacing) / 2;
  const offsetY = (height - rows * rowSpacing) / 2;

  let dots = '';
  for (let r = 0; r < rows; r++) {
    const rowOffset = r % 2 === 1 ? colSpacing * 0.5 : 0;
    for (let c = 0; c < cols; c++) {
      if (grid[r]![c]) {
        const cx = offsetX + rowOffset + c * colSpacing + colSpacing / 2;
        const cy = offsetY + r * rowSpacing + rowSpacing / 2;
        dots += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${dotRadius.toFixed(2)}" fill="#000"/>`;
      }
    }
  }

  const centerX = offsetX + (14.5 * colSpacing) + colSpacing * 0.5;
  const centerY = offsetY + (16 * rowSpacing) + rowSpacing / 2;
  let bullseye = '';
  const ringRadii = [3.6, 3.0, 2.4, 1.8, 1.2, 0.6].map((r) => r * scale);
  for (let i = 0; i < ringRadii.length; i++) {
    bullseye += `<circle cx="${centerX.toFixed(2)}" cy="${centerY.toFixed(2)}" r="${ringRadii[i]!.toFixed(2)}" fill="${i % 2 === 0 ? '#000' : '#fff'}"/>`;
  }

  return dots + bullseye;
}

function renderBarcode(obj: BarcodeObject): string {
  const styleEl = getChildNS(obj.element, NS.barcode, 'barcodeStyle');
  const humanReadable = styleEl?.getAttribute('humanReadable') !== 'false';
  const checkDigit = styleEl?.getAttribute('checkDigit') === 'true';
  const protocol = obj.protocol;
  const data = obj.data;
  const key = protocolKey(protocol);

  if (key === 'MAXICODE') {
    try {
      const grid = encodeMaxicode(data);
      const dots = renderMaxicodeGrid(grid, obj.width, obj.height);
      return (
        `<g${rotateTransform(obj)}>` +
        `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="#fff" stroke="#ccc" stroke-width="0.25"/>` +
        `<g transform="translate(${obj.x}, ${obj.y})">${dots}</g>` +
        `<title>${esc(protocol)}: ${esc(data)}</title>` +
        `</g>`
      );
    } catch {
      // falls through to the generic schematic-bars fallback below
    }
  }

  const matrixEncoder =
    key === 'QRCODE' || key === 'QR' || key === 'MICROQRCODE' || key === 'MICROQR'
      ? encodeQr
      : key === 'DATAMATRIX' || key === 'DATAMATRIXECC200'
        ? (d: string) => {
            // <barcode:datamatrixStyle model="square"|"rectangular"> — P-touch's own explicit shape
            // choice, which "auto" (smallest area) would otherwise override: ECC200's rectangular
            // sizes are never smaller-area than the nearest square, so "auto" alone always picks
            // square and a rectangular object box would get a square matrix stretched into it.
            const dmStyleEl = getChildNS(obj.element, NS.barcode, 'datamatrixStyle');
            const model = dmStyleEl?.getAttribute('model');
            const shape = model === 'rectangular' || model === 'square' ? model : 'auto';
            return encodeDataMatrix(d, { shape });
          }
        : key === 'PDF417' || key === 'PDF417TRUNCATED'
          ? (d: string) => {
              // <barcode:pdf417Style model="standard"|"truncate"|"micro" eccLevel="auto"|"0".."8">
              // — P-touch's own explicit variant + error-correction-level choice.
              const pdfStyleEl = getChildNS(obj.element, NS.barcode, 'pdf417Style');
              const model = pdfStyleEl?.getAttribute('model');
              const variant = model === 'truncate' || model === 'micro' ? model : key === 'PDF417TRUNCATED' ? 'truncate' : 'standard';
              const eccLevelAttr = pdfStyleEl?.getAttribute('eccLevel');
              const ecl = eccLevelAttr && eccLevelAttr !== 'auto' ? Number(eccLevelAttr) : undefined;
              return encodePdf417(d, { variant, ecl });
            }
          : undefined;
  if (matrixEncoder) {
    try {
      const matrix = matrixEncoder(data);
      const cells = renderMatrixBarcode(matrix, obj.width, obj.height);
      return (
        `<g${rotateTransform(obj)}>` +
        `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="#fff" stroke="#ccc" stroke-width="0.25"/>` +
        `<g transform="translate(${obj.x}, ${obj.y})">${cells}</g>` +
        `<title>${esc(protocol)}: ${esc(data)}</title>` +
        `</g>`
      );
    } catch {
      // falls through to the generic schematic-bars fallback below
    }
  }

  if (key === 'POSTNET' || key === 'IMB' || key === 'INTELLIGENTMAILBARCODE' || key === 'INTELLIGENTMAIL' || key === 'ONECODE' || key === 'USPSINTELLIGENTMAIL') {
    try {
      const pattern = key === 'POSTNET' ? encodePostnet(data) : encodeImb(data);
      const bars = key === 'POSTNET' ? renderPostnetBars(pattern, obj.width, obj.height) : renderImbBars(pattern, obj.width, obj.height);
      return (
        `<g${rotateTransform(obj)}>` +
        `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="#fff" stroke="#ccc" stroke-width="0.25"/>` +
        `<g transform="translate(${obj.x}, ${obj.y})">${bars}</g>` +
        `<title>${esc(protocol)}: ${esc(data)}</title>` +
        `</g>`
      );
    } catch {
      // falls through to the generic schematic-bars fallback below
    }
  }

  if (key === 'ISBN2' || key === 'ISBN5') {
    try {
      const digits = data.replace(/[^0-9]/g, '');
      const addonLen = key === 'ISBN2' ? 2 : 5;
      if (digits.length !== 13 + addonLen) throw new Error(`node-lbx: ${protocol} requires 13 + ${addonLen} digits`);
      const mainDigits = digits.slice(0, 13);
      const addonDigits = digits.slice(13);
      const mainWidth = obj.width * 0.78;
      const gapWidth = obj.width * 0.04;
      const addonWidth = obj.width - mainWidth - gapWidth;

      const mainBits = encodeEAN13(mainDigits);
      const addonBits = addonLen === 2 ? encodeEAN2(addonDigits) : encodeEAN5(addonDigits);
      const addonBarsHeight = obj.height * 0.8;

      return (
        `<g${rotateTransform(obj)}>` +
        `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="#fff" stroke="#ccc" stroke-width="0.25"/>` +
        `<g transform="translate(${obj.x}, ${obj.y})">${renderModuleBits(mainBits, mainWidth, obj.height, 7)}</g>` +
        `<g transform="translate(${obj.x + mainWidth + gapWidth}, ${obj.y})">${renderModuleBits(addonBits, addonWidth, addonBarsHeight, 4)}</g>` +
        `<title>${esc(protocol)}: ${esc(mainDigits)} + ${esc(addonDigits)}</title>` +
        `</g>`
      );
    } catch {
      // falls through to the generic schematic-bars fallback below
    }
  }

  const textHeight = humanReadable ? Math.min(10, obj.height * 0.25) : 0;
  const barsHeight = obj.height - textHeight;

  const bits = encodeLinearBarcode(protocol, data, checkDigit);
  const bars = bits ? renderModuleBits(bits, obj.width, barsHeight) : fakeBarcodeBars(data || protocol, obj.width, barsHeight);
  const scannable = bits !== undefined;

  const readable = humanReadable
    ? renderTextBlock(obj.x, obj.y + barsHeight, obj.width, textHeight, [data], { name: '', size: textHeight * 0.8, weight: 400, italic: false, color: '#000' }, { h: 'CENTER', v: 'TOP' })
    : '';

  return (
    `<g${rotateTransform(obj)}>` +
    `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="#fff" stroke="#ccc" stroke-width="0.25"/>` +
    `<g transform="translate(${obj.x}, ${obj.y})">${bars}</g>` +
    readable +
    `<title>${esc(protocol)}: ${esc(data)}${scannable ? '' : ' (schematic bars, not scannable)'}</title>` +
    `</g>`
  );
}

function renderTable(obj: TableObject): string {
  const gridEl = getChildNS(obj.element, NS.table, 'gridPosition');
  const colOffsets = (gridEl?.getAttribute('x') ?? '').split(/\s+/).filter(Boolean).map(parseFloat);
  const rowOffsets = (gridEl?.getAttribute('y') ?? '').split(/\s+/).filter(Boolean).map(parseFloat);

  let grid = `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="none" stroke="#333" stroke-width="0.75"/>`;
  for (const off of colOffsets) {
    grid += `<line x1="${obj.x + off}" y1="${obj.y}" x2="${obj.x + off}" y2="${obj.y + obj.height}" stroke="#333" stroke-width="0.4"/>`;
  }
  for (const off of rowOffsets) {
    grid += `<line x1="${obj.x}" y1="${obj.y + off}" x2="${obj.x + obj.width}" y2="${obj.y + off}" stroke="#333" stroke-width="0.4"/>`;
  }

  let cells = '';
  for (const cell of obj.getCells()) {
    const text = cell.textObject;
    if (text) cells += renderText(text);
  }

  return `<g${rotateTransform(obj)}>${grid}${cells}</g>`;
}

/** Anything without a dedicated renderer yet (draw:*, image:clipart, cable:*) — shown as a labeled placeholder box. */
function renderUnknown(obj: LabelObject): string {
  const tag = obj.element.tagName;
  return (
    `<g${rotateTransform(obj)}>` +
    `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="none" stroke="#c66" stroke-width="0.5" stroke-dasharray="3,2"/>` +
    renderTextBlock(obj.x, obj.y, obj.width, obj.height, [tag], { name: '', size: Math.min(7, obj.height / 2), weight: 400, italic: true, color: '#c66' }, { h: 'CENTER', v: 'CENTER' }) +
    `</g>`
  );
}

function renderObject(obj: LabelObject): string {
  if (obj instanceof GroupObject) {
    return `<g data-name="${esc(obj.objectName)}">${obj.getObjects().map(renderObject).join('')}</g>`;
  }
  if (obj instanceof TextObject) return renderText(obj);
  if (obj instanceof DateTimeObject) return renderDateTime(obj);
  if (obj instanceof ImageObject) return renderImage(obj);
  if (obj instanceof BarcodeObject) return renderBarcode(obj);
  if (obj instanceof TableObject) return renderTable(obj);
  return renderUnknown(obj);
}

function flattenObjects(objs: LabelObject[]): LabelObject[] {
  const result: LabelObject[] = [];
  for (const obj of objs) {
    result.push(obj);
    if (obj instanceof GroupObject) result.push(...flattenObjects(obj.getObjects()));
  }
  return result;
}

/**
 * Continuous tape labels declare `style:paper` as {width: fixed tape width, height: feed-direction
 * length} in the *tape roll's own frame* — independent of `orientation`, which instead says how
 * that frame maps onto the object x/y axes objects are positioned in. For "landscape" (the common
 * case for tape) the feed axis is x and the cross axis is y, so the on-screen canvas is
 * {width: paper.height, height: paper.width} with x/y used as-is; "portrait" keeps them unswapped.
 * When `autoLength` is set, the declared feed-axis length is just a generous upper bound (P-touch
 * trims the real print length to content), so it's replaced with the actual content extent.
 */
function computeCanvasSize(doc: LbxDocument): { width: number; height: number } {
  const paper = doc.getPaper();
  const isLandscape = paper.orientation !== 'portrait';

  let feedExtent: number = paper.height;
  if (paper.autoLength) {
    const objs = flattenObjects(doc.getObjects());
    const maxExtent = objs.reduce((max, o) => Math.max(max, isLandscape ? o.x + o.width : o.y + o.height), 0);
    if (maxExtent > 0) feedExtent = maxExtent + (isLandscape ? paper.marginRight : paper.marginBottom);
  }

  return isLandscape ? { width: feedExtent, height: paper.width } : { width: paper.width, height: feedExtent };
}

/**
 * Renders a label to an SVG string in the same pt coordinate space label.xml uses (1 SVG user
 * unit = 1pt), so it can be dropped straight into an <img>/<object> or written to a .svg file.
 * This is a visual approximation for previewing layout, fonts, and placement: barcodes are drawn
 * as a schematic bar pattern (not scannable), and glyph rendering depends on fonts installed in
 * whatever ultimately renders the SVG, same as any other SVG text.
 */
export function renderToSvg(doc: LbxDocument, opts: RenderOptions = {}): string {
  const padding = opts.padding ?? 0;
  const { width: paperWidth, height: paperHeight } = computeCanvasSize(doc);
  const width = paperWidth + padding * 2;
  const height = paperHeight + padding * 2;

  const body = doc.getObjects().map(renderObject).join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-padding} ${-padding} ${width} ${height}">` +
    `<rect x="${-padding}" y="${-padding}" width="${width}" height="${height}" fill="#ffffff"/>` +
    `<rect x="0" y="0" width="${paperWidth}" height="${paperHeight}" fill="#ffffff" stroke="#dddddd" stroke-width="0.5"/>` +
    body +
    `</svg>`
  );
}
