/**
 * QR Code encoder (ISO/IEC 18004). Byte-mode only: every input byte costs 8 bits regardless of
 * content, which is less compact than the spec's optimal Numeric/Alphanumeric/Kanji mode mixing
 * but decodes identically on any real scanner — the same "always correct, not always smallest"
 * tradeoff this library makes for Code 128 (Set B only) and GS1-128.
 */
import { GF256_QR } from './galoisField.js';
import { MAX_DATA_BITS, MAX_CODEWORDS, RS_ECC_CODEWORDS, RS_BLOCK_COUNT, ALIGNMENT_CENTRES, MATRIX_REMAIN_BIT, FORMAT_INFO, versionInfoBits } from './qrTables.js';

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  /** Error correction level, default 'M' (~15% recoverable). */
  ecl?: QrErrorCorrection;
}

// Table row order is M, L, H, Q (see qrTables.ts) — not the usual L/M/Q/H reading order.
const ECL_INDEX: Record<QrErrorCorrection, number> = { M: 0, L: 1, H: 2, Q: 3 };

function buildFrame(version: number): { dark: boolean[][]; occupied: boolean[][] } {
  const size = 17 + version * 4;
  const dark: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const occupied: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  const setModule = (row: number, col: number, isDark: boolean): void => {
    dark[row]![col] = isDark;
    occupied[row]![col] = true;
  };

  // Finder patterns (3 corners) with their light separator ring.
  for (const [row0, col0] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = row0 + r;
        const col = col0 + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const inBlock = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        setModule(row, col, inBlock && (ring || core));
      }
    }
  }

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns, skipping the three that overlap a finder corner.
  const centres = ALIGNMENT_CENTRES[version - 1]!;
  for (const cr of centres) {
    for (const cc of centres) {
      if ((cr < 9 && cc < 9) || (cr < 9 && cc > size - 10) || (cr > size - 10 && cc < 9)) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          setModule(cr + r, cc + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    }
  }

  // Reserve format-info areas (filled in after mask selection) and the always-dark module.
  for (let i = 0; i < 9; i++) {
    occupied[8]![i] = true;
    occupied[i]![8] = true;
  }
  for (let i = 0; i < 8; i++) {
    occupied[8]![size - 1 - i] = true;
    occupied[size - 1 - i]![8] = true;
  }
  setModule(size - 8, 8, true);

  if (version >= 7) {
    const bits = versionInfoBits(version);
    for (let i = 0; i < 18; i++) {
      const isDark = ((bits >> i) & 1) === 1;
      const row = Math.floor(i / 3);
      const col = size - 11 + (i % 3);
      setModule(row, col, isDark);
      setModule(col, row, isDark);
    }
  }

  return { dark, occupied };
}

/** Data-module placement order as [col, row] pairs: column pairs right to left, alternating scan direction, skipping the timing column and occupied modules. */
function placementSequence(size: number, occupied: boolean[][]): [number, number][] {
  const sequence: [number, number][] = [];
  let col = size - 1;
  let upward = true;
  while (col > 0) {
    if (col === 6) col -= 1;
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (!occupied[row]![c]) sequence.push([c, row]);
      }
    }
    upward = !upward;
    col -= 2;
  }
  return sequence;
}

const MASK_CONDITIONS: readonly ((row: number, col: number) => boolean)[] = [
  (row, col) => (row + col) % 2 === 0,
  (row) => row % 2 === 0,
  (_row, col) => col % 3 === 0,
  (row, col) => (row + col) % 3 === 0,
  (row, col) => (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0,
  (row, col) => ((row * col) % 2) + ((row * col) % 3) === 0,
  (row, col) => (((row * col) % 2) + ((row * col) % 3)) % 2 === 0,
  (row, col) => (((row + col) % 2) + ((row * col) % 3)) % 2 === 0,
];

function penalty(matrix: boolean[][]): number {
  const size = matrix.length;
  let score = 0;

  // N1: runs of 5+ same-colour modules, in rows then columns.
  const scoreRuns = (getCell: (i: number, j: number) => boolean): number => {
    let s = 0;
    for (let i = 0; i < size; i++) {
      let runLen = 1;
      let prev = getCell(i, 0);
      for (let j = 1; j < size; j++) {
        const cur = getCell(i, j);
        if (cur === prev) {
          runLen++;
        } else {
          if (runLen >= 5) s += runLen - 2;
          runLen = 1;
          prev = cur;
        }
      }
      if (runLen >= 5) s += runLen - 2;
    }
    return s;
  };
  score += scoreRuns((i, j) => matrix[i]![j]!);
  score += scoreRuns((i, j) => matrix[j]![i]!);

  // N2: 2x2 same-colour blocks (overlapping blocks all count).
  for (let i = 0; i < size - 1; i++) {
    for (let j = 0; j < size - 1; j++) {
      const v = matrix[i]![j]!;
      if (matrix[i]![j + 1] === v && matrix[i + 1]![j] === v && matrix[i + 1]![j + 1] === v) score += 3;
    }
  }

  // N3: 1:1:3:1:1 finder-like pattern with 4 light modules on one or both flanks.
  const finderPattern = [true, false, true, true, true, false, true];
  const scoreFinderLike = (getCell: (i: number, j: number) => boolean): number => {
    let s = 0;
    for (let i = 0; i < size; i++) {
      const line = Array.from({ length: size }, (_, j) => getCell(i, j));
      for (let j = 0; j <= size - 7; j++) {
        let matches = true;
        for (let k = 0; k < 7; k++) {
          if (line[j + k] !== finderPattern[k]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
        const lightBefore = j >= 4 && [1, 2, 3, 4].every((d) => line[j - d] === false);
        const lightAfter = j + 10 < size && [7, 8, 9, 10].every((d) => line[j + d] === false);
        if (lightBefore) s += 40;
        if (lightAfter) s += 40;
      }
    }
    return s;
  };
  score += scoreFinderLike((i, j) => matrix[i]![j]!);
  score += scoreFinderLike((i, j) => matrix[j]![i]!);

  // N4: 10 points per 5% deviation of the dark-module ratio from 50%.
  let dark = 0;
  for (const row of matrix) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/** Encodes `data` (as UTF-8 bytes, QR byte mode) into a square boolean matrix — `true` = dark module. */
export function encodeQr(data: string, opts: QrOptions = {}): boolean[][] {
  const eclChar = opts.ecl ?? 'M';
  const ecl = ECL_INDEX[eclChar];
  const bytes = Buffer.from(data, 'utf8');

  let version = 0;
  let maxBits = 0;
  for (let v = 1; v <= 40; v++) {
    const charCountBits = v <= 9 ? 8 : 16;
    const segBits = 4 + charCountBits + 8 * bytes.length;
    const candidateMax = MAX_DATA_BITS[v - 1 + 40 * ecl]!;
    if (candidateMax >= segBits) {
      version = v;
      maxBits = candidateMax;
      break;
    }
  }
  if (version === 0) throw new Error(`node-lbx: QR data too long (${bytes.length} bytes) to fit any symbol at ECL ${eclChar}`);

  const charCountBits = version <= 9 ? 8 : 16;
  const bits: number[] = [0, 1, 0, 0]; // byte mode indicator
  for (let i = charCountBits - 1; i >= 0; i--) bits.push((bytes.length >> i) & 1);
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);

  const terminatorLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const maxDataCodewords = maxBits / 8;
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    codewords.push(byte);
  }
  const padCycle = [0xec, 0x11];
  for (let i = codewords.length; i < maxDataCodewords; i++) codewords.push(padCycle[(i - codewords.length) % 2]!);

  const tableIndex = version - 1 + 40 * ecl;
  const totalCodewords = MAX_CODEWORDS[version]!;
  const rsEcc = RS_ECC_CODEWORDS[tableIndex]!;
  const blockCount = RS_BLOCK_COUNT[tableIndex]!;
  const shortBlock = Math.floor(totalCodewords / blockCount);
  const longBlocks = totalCodewords % blockCount;
  const blockSizes = [...new Array(blockCount - longBlocks).fill(shortBlock), ...new Array(longBlocks).fill(shortBlock + 1)] as number[];
  const dataLengths = blockSizes.map((b) => b - rsEcc);

  const dataBlocks: number[][] = [];
  let cursor = 0;
  for (const len of dataLengths) {
    dataBlocks.push(codewords.slice(cursor, cursor + len));
    cursor += len;
  }
  const ecBlocks = dataBlocks.map((block) => GF256_QR.encode(block, rsEcc, 0));

  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(...dataLengths);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < blockCount; b++) if (i < dataLengths[b]!) finalCodewords.push(dataBlocks[b]![i]!);
  }
  for (let i = 0; i < rsEcc; i++) {
    for (let b = 0; b < blockCount; b++) finalCodewords.push(ecBlocks[b]![i]!);
  }

  const dataBits: boolean[] = [];
  for (const byte of finalCodewords) for (let i = 7; i >= 0; i--) dataBits.push(((byte >> i) & 1) === 1);
  const remainderBits = MATRIX_REMAIN_BIT[version - 1]!;
  for (let i = 0; i < remainderBits; i++) dataBits.push(true); // unmasked "1" for remainder positions, per spec these carry no meaning

  const { dark: frame, occupied } = buildFrame(version);
  const size = frame.length;
  const seq = placementSequence(size, occupied);

  let bestScore = Infinity;
  let bestMask = 0;
  for (let maskId = 0; maskId < 8; maskId++) {
    const condition = MASK_CONDITIONS[maskId]!;
    const matrix = frame.map((row) => [...row]);
    for (let i = 0; i < seq.length; i++) {
      const [col, row] = seq[i]!;
      matrix[row]![col] = dataBits[i]! !== condition(row, col);
    }
    const score = penalty(matrix);
    if (score < bestScore) {
      bestScore = score;
      bestMask = maskId;
    }
  }

  const condition = MASK_CONDITIONS[bestMask]!;
  const matrix = frame.map((row) => [...row]);
  for (let i = 0; i < seq.length; i++) {
    const [col, row] = seq[i]!;
    matrix[row]![col] = dataBits[i]! !== condition(row, col);
  }

  const formatBits = FORMAT_INFO[(ecl << 3) | bestMask]!;
  const formatX1 = [0, 1, 2, 3, 4, 5, 7, 8, 8, 8, 8, 8, 8, 8, 8];
  const formatY1 = [8, 8, 8, 8, 8, 8, 8, 8, 7, 5, 4, 3, 2, 1, 0];
  const formatX2 = [8, 8, 8, 8, 8, 8, 8, ...Array.from({ length: 8 }, (_, i) => size - 8 + i)];
  const formatY2 = [...Array.from({ length: 7 }, (_, i) => size - 1 - i), 8, 8, 8, 8, 8, 8, 8, 8];
  for (let i = 0; i < 15; i++) {
    const bit = formatBits[i] === '1';
    matrix[formatY1[i]!]![formatX1[i]!] = bit;
    matrix[formatY2[i]!]![formatX2[i]!] = bit;
  }

  return matrix;
}
