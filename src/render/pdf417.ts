/**
 * PDF417 encoder (ISO/IEC 15438) and MicroPDF417 (ISO/IEC 24728). Byte Compaction mode only —
 * every input byte costs a fixed share of a codeword (6 bytes -> 5 codewords via base-900
 * packing) regardless of content; the spec's Text/Numeric compaction modes pack plain text and
 * digit runs tighter, but byte mode decodes identically on any real scanner. Same tradeoff made
 * throughout this renderer.
 *
 * Three variants, matching P-touch's `barcode:pdf417Style model=`:
 * - `standard`: full PDF417, as specified.
 * - `truncate` (a.k.a. Compact PDF417): drops the right row indicator codeword's bar pattern and
 *   shrinks the stop pattern to a single dark module — narrower, at the cost of the redundant
 *   right-side row-parity check a full symbol carries. Same codewords/error correction as
 *   `standard`, purely a rendering difference (confirmed by comparing rendered widths against
 *   BWIPP's `pdf417`/`pdf417compact` for identical data: the difference is exactly 34 modules —
 *   17 for the dropped codeword + 17 for the shortened stop).
 * - `micro`: MicroPDF417, a related but distinct symbology — different row layout (Row Address
 *   Patterns instead of numeric row-indicator codewords), a fixed table of 34 valid
 *   column/row/error-correction combinations instead of a free `ecl` choice, and no traditional
 *   start/stop pattern. Reuses this module's Byte Compaction and Reed-Solomon (both are
 *   symbology-agnostic math, verified against MicroPDF417's own precomputed generator-polynomial
 *   table — see the render/svg.ts barcode verification). Column count is always auto-selected
 *   (matches every real-world `pdf417Style` sample seen, which sets `column="auto"` for micro).
 */
import { CLUSTER_0, CLUSTER_3, CLUSTER_6 } from './pdf417ClusterPatterns.js';
import { MICRO_VARIANTS, RAP_TABLE, RAP_SIDE, RAP_CENTRE, MICRO_AUTOSIZE_THRESHOLDS, MICRO_AUTOSIZE_VARIANTS } from './microPdf417Tables.js';

const PDF417_PRIME = 929;
const PDF417_PRIMITIVE = 3;
const LATCH_BYTE = 901;
const PAD_CODEWORD = 900;
const START_WIDTH = 17;
const STOP_WIDTH = 18;
const CODEWORD_WIDTH = 17;
const START_PATTERN = 0x1fea8; // widths 8,1,1,1,1,1,1,3
const STOP_PATTERN = 0x3fa29; // widths 7,1,1,3,1,1,1,2,1
const DEFAULT_ROW_HEIGHT = 3;
const MICRO_ROW_HEIGHT = 2; // ISO/IEC 24728:2006 5.8.2's minimum row height for MicroPDF417

export type Pdf417Variant = 'standard' | 'truncate' | 'micro';

export interface Pdf417Options {
  /** Error correction level 0-8; more codewords survive damage at higher levels. Default 2 (spec's minimum recommendation for small payloads). Ignored for `variant: 'micro'` — MicroPDF417's error correction is fixed by its size table, not independently selectable. */
  ecl?: number;
  /** Default 'standard'. */
  variant?: Pdf417Variant;
}

function ecCodewordCount(ecl: number): number {
  return 1 << (ecl + 1);
}

function generatorCoefficients(numEc: number, firstRoot: number): number[] {
  let poly = [1];
  for (let i = 0; i < numEc; i++) {
    const root = Number(BigInt(PDF417_PRIMITIVE) ** BigInt(firstRoot + i) % BigInt(PDF417_PRIME));
    const next = [...poly, 0];
    for (let j = 0; j < poly.length; j++) next[j + 1] = ((next[j + 1]! - root * poly[j]!) % PDF417_PRIME + PDF417_PRIME) % PDF417_PRIME;
    poly = next;
  }
  return poly.slice(1);
}

function reedSolomonEncodePdf417(data: number[], numEc: number): number[] {
  const gen = generatorCoefficients(numEc, 1);
  const buffer = [...data, ...new Array<number>(numEc).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const lead = ((buffer[i]! % PDF417_PRIME) + PDF417_PRIME) % PDF417_PRIME;
    if (lead !== 0) {
      for (let j = 0; j < numEc; j++) buffer[i + 1 + j]! -= lead * gen[j]!;
    }
  }
  return buffer.slice(data.length).map((r) => (PDF417_PRIME - (((r % PDF417_PRIME) + PDF417_PRIME) % PDF417_PRIME)) % PDF417_PRIME);
}

/** Byte Compaction mode: groups of 6 bytes -> 5 base-900 codewords; a short trailing group emits one codeword per byte. */
function byteCompact(bytes: Buffer): number[] {
  const cws: number[] = [];
  const full = Math.floor(bytes.length / 6) * 6;
  for (let start = 0; start < full; start += 6) {
    let t = 0n;
    for (let i = start; i < start + 6; i++) t = t * 256n + BigInt(bytes[i]!);
    const out: number[] = [];
    for (let i = 0; i < 5; i++) {
      out.push(Number(t % 900n));
      t /= 900n;
    }
    cws.push(...out.reverse());
  }
  for (let i = full; i < bytes.length; i++) cws.push(bytes[i]!);
  return cws;
}

function rowModules(columns: number): number {
  return START_WIDTH + CODEWORD_WIDTH * (columns + 2) + STOP_WIDTH;
}

function maxRows(columns: number): number {
  return Math.min(90, Math.floor(928 / columns));
}

function pickRows(sourceCount: number, ecl: number, columns: number): number {
  const k = ecCodewordCount(ecl);
  const required = sourceCount + 1 + k;
  const rows = Math.max(3, Math.ceil(required / columns));
  if (rows > maxRows(columns)) {
    throw new Error(`node-lbx: PDF417 data does not fit at columns=${columns} (needs ${rows} rows, max ${maxRows(columns)})`);
  }
  return rows;
}

/** Picks the column count minimizing symbol area within a scannable width:height aspect ratio (1.5-8), same heuristic as the reference encoder this was verified against. */
function autoColumns(totalCodewords: number): number {
  const inBand: [number, number][] = [];
  const feasible: [number, number][] = [];
  for (let columns = 1; columns <= 30; columns++) {
    const rows = Math.max(3, Math.ceil(totalCodewords / columns));
    if (rows > maxRows(columns)) continue;
    const width = rowModules(columns);
    const aspect = width / (DEFAULT_ROW_HEIGHT * rows);
    feasible.push([aspect, columns]);
    if (aspect >= 1.5 && aspect <= 8) inBand.push([rows * width, -columns]);
  }
  if (inBand.length > 0) return -inBand.reduce((min, cur) => (cur[0] < min[0] ? cur : min))[1];
  if (feasible.length > 0) return feasible.reduce((min, cur) => (cur[0] < min[0] ? cur : min))[1];
  return 30;
}

function leftRowIndicator(row: number, rows: number, columns: number, ecl: number): number {
  const k = ((row - 1) % 3) * 3;
  const base = 30 * Math.floor((row - 1) / 3);
  if (k === 0) return base + Math.floor((rows - 1) / 3);
  if (k === 3) return base + ecl * 3 + ((rows - 1) % 3);
  return base + (columns - 1);
}

function rightRowIndicator(row: number, rows: number, columns: number, ecl: number): number {
  const k = ((row - 1) % 3) * 3;
  const base = 30 * Math.floor((row - 1) / 3);
  if (k === 0) return base + (columns - 1);
  if (k === 3) return base + Math.floor((rows - 1) / 3);
  return base + ecl * 3 + ((rows - 1) % 3);
}

function bitsOf(pattern: number, width: number): boolean[] {
  return Array.from({ length: width }, (_, i) => ((pattern >> (width - 1 - i)) & 1) === 1);
}

const CLUSTERS = [CLUSTER_0, CLUSTER_3, CLUSTER_6];

/** Builds `standard` or `truncate` PDF417 — identical codewords/error correction either way; `truncate` just omits the right row indicator's bars and shrinks the stop pattern to one dark module. */
function buildStandardOrTruncated(data: string, ecl: number, truncate: boolean): boolean[][] {
  const bytes = Buffer.from(data, 'utf8');
  const source = [LATCH_BYTE, ...byteCompact(bytes)];

  const columns = autoColumns(source.length + 1 + ecCodewordCount(ecl));
  const rows = pickRows(source.length, ecl, columns);

  const k = ecCodewordCount(ecl);
  const n = columns * rows - k;
  const padCount = n - source.length - 1;
  if (padCount < 0) throw new Error('node-lbx: PDF417 data too long for the selected symbol size');
  const codewords = [n, ...source, ...new Array<number>(padCount).fill(PAD_CODEWORD)];
  const ec = reedSolomonEncodePdf417(codewords, k);
  const allCodewords = [...codewords, ...ec];

  const startBits = bitsOf(START_PATTERN, START_WIDTH);
  const stopBits = truncate ? [true] : bitsOf(STOP_PATTERN, STOP_WIDTH);

  const matrix: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const f = r + 1;
    const cluster = CLUSTERS[(f - 1) % 3]!;
    const leftCw = leftRowIndicator(f, rows, columns, ecl);
    const rowData = allCodewords.slice(r * columns, (r + 1) * columns);

    const rowBits: boolean[] = [...startBits, ...bitsOf(cluster[leftCw]!, CODEWORD_WIDTH)];
    for (const cw of rowData) rowBits.push(...bitsOf(cluster[cw]!, CODEWORD_WIDTH));
    if (!truncate) {
      const rightCw = rightRowIndicator(f, rows, columns, ecl);
      rowBits.push(...bitsOf(cluster[rightCw]!, CODEWORD_WIDTH));
    }
    rowBits.push(...stopBits);

    for (let h = 0; h < DEFAULT_ROW_HEIGHT; h++) matrix.push([...rowBits]);
  }

  return matrix;
}

/** Builds MicroPDF417: variant auto-selected from the 34-entry ISO/IEC 24728:2006 Table 1, Row Address Pattern row layout instead of numeric row indicators. */
function buildMicroPdf417(data: string): boolean[][] {
  const bytes = Buffer.from(data, 'utf8');
  const source = [LATCH_BYTE, ...byteCompact(bytes)];
  if (source.length > 126) throw new Error(`node-lbx: MicroPDF417 data too long (${source.length} codewords, max 126)`);

  let variant = -1;
  for (let i = 0; i < MICRO_AUTOSIZE_THRESHOLDS.length; i++) {
    if (MICRO_AUTOSIZE_THRESHOLDS[i]! >= source.length) {
      variant = MICRO_AUTOSIZE_VARIANTS[i]! - 1;
      break;
    }
  }
  if (variant === -1) throw new Error(`node-lbx: MicroPDF417 data too long (${source.length} codewords)`);

  const columns = MICRO_VARIANTS[0]![variant]!;
  const rows = MICRO_VARIANTS[1]![variant]!;
  const eccCwds = MICRO_VARIANTS[2]![variant]!;
  const nonEcCwds = columns * rows - eccCwds;
  const padCount = nonEcCwds - source.length;
  const codewords = [...source, ...new Array<number>(padCount).fill(PAD_CODEWORD)];
  const ec = reedSolomonEncodePdf417(codewords, eccCwds);
  const allCodewords = [...codewords, ...ec];

  let leftRap = RAP_TABLE[0]![variant]! - 1;
  let centreRap = RAP_TABLE[1]![variant]! - 1;
  let rightRap = RAP_TABLE[2]![variant]! - 1;
  let cluster = RAP_TABLE[3]![variant]!;

  const matrix: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const clusterTable = CLUSTERS[cluster]!;
    const rowData = allCodewords.slice(r * columns, (r + 1) * columns);

    const rowBits: boolean[] = [...bitsOf(RAP_SIDE[leftRap]!, 10), ...bitsOf(clusterTable[rowData[0]!]!, CODEWORD_WIDTH)];
    if (columns >= 2) {
      if (columns === 3) rowBits.push(...bitsOf(RAP_CENTRE[centreRap]!, 10));
      rowBits.push(...bitsOf(clusterTable[rowData[1]!]!, CODEWORD_WIDTH));
      if (columns >= 3) {
        if (columns === 4) rowBits.push(...bitsOf(RAP_CENTRE[centreRap]!, 10));
        rowBits.push(...bitsOf(clusterTable[rowData[2]!]!, CODEWORD_WIDTH));
        if (columns === 4) rowBits.push(...bitsOf(clusterTable[rowData[3]!]!, CODEWORD_WIDTH));
      }
    }
    rowBits.push(...bitsOf(RAP_SIDE[rightRap]!, 10), true); // single-module stop

    for (let h = 0; h < MICRO_ROW_HEIGHT; h++) matrix.push([...rowBits]);

    leftRap = leftRap === 51 ? 0 : leftRap + 1;
    centreRap = centreRap === 51 ? 0 : centreRap + 1;
    rightRap = rightRap === 51 ? 0 : rightRap + 1;
    cluster = cluster === 2 ? 0 : cluster + 1;
  }

  return matrix;
}

/** Encodes `data` (UTF-8 bytes, Byte Compaction mode) into the final PDF417/MicroPDF417 module grid (`true` = dark), no quiet zone. */
export function encodePdf417(data: string, opts: Pdf417Options = {}): boolean[][] {
  const variant = opts.variant ?? 'standard';
  if (variant === 'micro') return buildMicroPdf417(data);
  return buildStandardOrTruncated(data, opts.ecl ?? 2, variant === 'truncate');
}
