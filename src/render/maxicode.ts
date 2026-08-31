/**
 * MaxiCode encoder (ISO/IEC 16023), Mode 4 (general/standard, unstructured) only — Modes 2/3's
 * structured postal primary message (US postal code + country + service class) and Mode 5's
 * enhanced error correction aren't implemented. Ported from zint's `maxicode.c`/`.h`
 * (BSD-3-Clause).
 *
 * Character encoding is a simplified greedy version of the spec's Code Set A/B/C/D/E state
 * machine: zint's real encoder is a cost-optimal dynamic-programming pass with digit-run
 * compaction and temporary shifts; this only ever *latches* to whichever set contains the next
 * character (preferring A, then B, C, D, E), skipping the shift and digit-compaction ops
 * entirely. Always produces a valid, decodable symbol — just not always the most compact one
 * (same tradeoff made throughout this renderer, e.g. Code 128 Set B only).
 */
import { GF256_DATAMATRIX } from './galoisField.js';
import { MAXI_GRID, MAXI_CODE_SET, MAXI_SYMBOL_CHAR } from './maxicodeTables.js';
import { latin1Bytes } from './bytes.js';

// Code Set state indices, matching zint's MX_STATES order.
const SET_A = 0;
const SET_B = 1;
const SET_E = 2;
const SET_C = 3;
const SET_D = 4;

const SET_FLAG = [0x01, 0x02, 0x04, 0x08, 0x10]; // indexed by state, matching MAXI_CODE_SET's bit flags

// mx_latch_seq[from][to]: codeword(s) that switch Code Set.
const LATCH_SEQ: readonly (readonly number[])[][] = [
  /* A */ [[], [63], [58], [58], [58]],
  /* B */ [[63], [], [63], [63], [63]],
  /* E */ [
    [62, 62],
    [62, 62],
    [],
    [62, 62],
    [62, 62],
  ],
  /* C */ [
    [60, 60],
    [60, 60],
    [60, 60],
    [],
    [60, 60],
  ],
  /* D */ [
    [61, 61],
    [61, 61],
    [61, 61],
    [61, 61],
    [],
  ],
];

// Preference order for picking a target Code Set when the current one can't encode a character.
const TARGET_PREFERENCE = [SET_A, SET_B, SET_C, SET_D, SET_E];

/** Ported from `mx_symbol_ch`: resolves the symbol value for a byte in a given (latched, non-shift) Code Set. */
function symbolValue(state: number, byte: number): number {
  const flag = SET_FLAG[state]!;
  if (MAXI_CODE_SET[byte] === flag || state === SET_A) return MAXI_SYMBOL_CHAR[byte]!;
  if (state === SET_B) {
    const p = ' ,./:'.indexOf(String.fromCharCode(byte));
    if (p >= 0) return 47 + p;
  }
  if (state === SET_E && byte >= 28 && byte <= 30) return byte + 4;
  return byte === 32 ? 59 : byte;
}

/** Greedy Code Set encoder. Returns exactly 93 message codewords (padded), throwing if the input doesn't fit. */
function encodeMessage(bytes: Uint8Array): number[] {
  let state = SET_A;
  const out: number[] = [];

  for (const byte of bytes) {
    const flag = MAXI_CODE_SET[byte]!;
    if (!(flag & SET_FLAG[state]!)) {
      const target = TARGET_PREFERENCE.find((t) => flag & SET_FLAG[t]!);
      if (target === undefined) throw new Error(`node-lbx: MaxiCode cannot encode byte ${byte}`);
      out.push(...LATCH_SEQ[state]![target]!);
      state = target;
    }
    out.push(symbolValue(state, byte));
    if (out.length > 93) throw new Error('node-lbx: MaxiCode data too long for a Mode 4 symbol (max ~93 codewords)');
  }

  if (state === SET_C || state === SET_D) {
    out.push(58); // Latch A, so padding isn't misread as more Set C/D data
    state = SET_A;
  }
  const padValue = state === SET_E ? 28 : 33;
  while (out.length < 93) out.push(padValue);

  return out;
}

/** Encodes `data` (as Latin-1 bytes — MaxiCode's Code Sets cover the full 0-255 byte range) into the 33x30 module grid (`true` = dark), Mode 4. */
export function encodeMaxicode(data: string): boolean[][] {
  const bytes = latin1Bytes(data);
  const message = encodeMessage(bytes);

  const codewords = new Array<number>(144).fill(0);
  codewords[0] = 4; // Mode 4
  for (let i = 0; i < 9; i++) codewords[1 + i] = message[i]!;
  for (let i = 0; i < 84; i++) codewords[20 + i] = message[9 + i]!;

  const primaryEcc = GF256_DATAMATRIX.encode(codewords.slice(0, 10), 10, 1);
  for (let i = 0; i < 10; i++) codewords[10 + i] = primaryEcc[i]!;

  const evenData = Array.from({ length: 42 }, (_, i) => codewords[20 + i * 2]!);
  const oddData = Array.from({ length: 42 }, (_, i) => codewords[21 + i * 2]!);
  const evenEcc = GF256_DATAMATRIX.encode(evenData, 20, 1);
  const oddEcc = GF256_DATAMATRIX.encode(oddData, 20, 1);
  for (let j = 0; j < 20; j++) {
    codewords[104 + j * 2] = evenEcc[j]!;
    codewords[104 + j * 2 + 1] = oddEcc[j]!;
  }

  const grid: boolean[][] = Array.from({ length: 33 }, () => new Array<boolean>(30).fill(false));
  for (let r = 0; r < 33; r++) {
    for (let c = 0; c < 30; c++) {
      const modSeq = MAXI_GRID[r * 30 + c]! + 5;
      const block = Math.floor(modSeq / 6);
      if (block !== 0) {
        grid[r]![c] = ((codewords[block - 1]! >> (5 - (modSeq % 6))) & 1) === 1;
      }
    }
  }

  // Fixed orientation markers, set unconditionally regardless of codeword content.
  const markers: [number, number][] = [
    [0, 28],
    [0, 29],
    [9, 10],
    [9, 11],
    [10, 11],
    [15, 7],
    [16, 8],
    [16, 20],
    [17, 20],
    [22, 10],
    [23, 10],
    [22, 17],
    [23, 17],
  ];
  for (const [r, c] of markers) grid[r]![c] = true;

  return grid;
}
