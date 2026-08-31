/**
 * GS1 DataBar Omnidirectional encoder (ISO/IEC 24724; formerly "RSS-14" — the format P-touch's
 * menu lists as "GS2 DataBar(RSS)", almost certainly a typo for GS1). Ported from zint's
 * `rss.c`/`rss.h` (BSD-3-Clause; the core `dbar_combins`/`dbar_getWidths` combinatorics carry a
 * separate BSI copyright with explicit permission to use "in the course of implementing the
 * standard" — https://github.com/zint/zint/blob/master/backend/rss.c), which itself traces to
 * `combins()`/`getRSSwidths()` in ISO/IEC 24724:2011 Annex B.
 */

// `combins(n, r)`: n choose r, for the n/r range DataBar Omnidirectional actually uses.
const COMBINS: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 2, 1, 1, 1, 1],
  [1, 3, 3, 1, 1, 1],
  [1, 4, 6, 4, 1, 1],
  [1, 5, 10, 10, 5, 1],
  [1, 6, 15, 20, 15, 6],
  [1, 7, 21, 35, 35, 21],
  [1, 8, 28, 56, 70, 56],
  [1, 9, 36, 84, 126, 126],
  [1, 10, 45, 120, 210, 252],
  [1, 11, 55, 165, 330, 462],
  [1, 12, 66, 220, 495, 792],
  [1, 13, 78, 286, 715, 1287],
  [1, 14, 91, 364, 1001, 2002],
  [1, 15, 105, 455, 1365, 3003],
  [1, 16, 120, 560, 1820, 4368],
  [1, 17, 136, 680, 2380, 6188],
];
function combins(n: number, r: number): number {
  return COMBINS[n]![r]!;
}

/** Ported from `dbar_getWidths` (ISO/IEC 24724:2011 Annex B `getRSSwidths`): the element-width combinatorics for one odd/even subset value. */
function getWidths(val: number, n: number, elements: number, maxWidth: number, noNarrow: boolean): number[] {
  const widths = new Array<number>(elements);
  let narrowMask = 0;
  let remaining = n;
  let remainingVal = val;
  let bar = 0;

  for (bar = 0; bar < elements - 1; bar++) {
    let elmWidth = 1;
    narrowMask |= 1 << bar;
    let subVal = 0;
    for (;;) {
      subVal = combins(remaining - elmWidth - 1, elements - bar - 2);
      if (noNarrow && narrowMask === 0 && remaining - elmWidth - (elements - bar - 1) >= elements - bar - 1) {
        subVal -= combins(remaining - elmWidth - (elements - bar), elements - bar - 2);
      }
      if (elements - bar - 1 > 1) {
        let lessVal = 0;
        for (let mxwElement = remaining - elmWidth - (elements - bar - 2); mxwElement > maxWidth; mxwElement--) {
          lessVal += combins(remaining - elmWidth - mxwElement - 1, elements - bar - 3);
        }
        subVal -= lessVal * (elements - 1 - bar);
      } else if (remaining - elmWidth > maxWidth) {
        subVal--;
      }
      remainingVal -= subVal;
      if (remainingVal < 0) break;
      // C's for-loop increment clause: only runs when the trial above didn't break.
      elmWidth++;
      narrowMask &= ~(1 << bar);
    }
    remainingVal += subVal;
    remaining -= elmWidth;
    widths[bar] = elmWidth;
  }
  widths[bar] = remaining;
  return widths;
}

/** Interleaves the odd/even `getWidths` results into one alternating width array. */
function widthsInterleaved(vOdd: number, vEven: number, nOdd: number, nEven: number, elements: number, maxWidth: number, noNarrow: boolean): number[] {
  const odd = getWidths(vOdd, nOdd, elements, maxWidth, noNarrow);
  const even = getWidths(vEven, nEven, elements, 9 - maxWidth, !noNarrow);
  const out = new Array<number>(elements * 2);
  for (let i = 0; i < elements; i++) {
    out[i * 2] = odd[i]!;
    out[i * 2 + 1] = even[i]!;
  }
  return out;
}

const G_SUM = [0, 161, 961, 2015, 2715, 0, 336, 1036, 1516];
const T_EVEN_ODD = [1, 10, 34, 70, 126, 4, 20, 48, 81];
const MODULES = [12, 10, 8, 6, 4, 5, 7, 9, 11, 4, 6, 8, 10, 12, 10, 8, 6, 4];
const WIDEST = [8, 6, 4, 3, 1, 2, 4, 6, 8];
const FINDER_PATTERN: readonly (readonly number[])[] = [
  [3, 8, 2, 1, 1],
  [3, 5, 5, 1, 1],
  [3, 3, 7, 1, 1],
  [3, 1, 9, 1, 1],
  [2, 7, 4, 1, 1],
  [2, 5, 6, 1, 1],
  [2, 3, 8, 1, 1],
  [1, 5, 7, 1, 1],
  [1, 3, 9, 1, 1],
];
const CHECKSUM_WEIGHT: readonly (readonly number[])[] = [
  [1, 3, 9, 27, 2, 6, 18, 54],
  [4, 12, 36, 29, 8, 24, 72, 58],
  [16, 48, 65, 37, 32, 17, 51, 74],
  [64, 34, 23, 69, 49, 68, 46, 59],
];

function group(val: number, outside: boolean): number {
  const start = outside ? 0 : 5;
  const end = outside ? 4 : 8;
  for (let i = start; i < end; i++) {
    if (val < G_SUM[i + 1]!) return i;
  }
  return end;
}

function gs1CheckDigit(digits: number[]): number {
  let factor = digits.length % 2 === 1 ? 3 : 1;
  let count = 0;
  for (const d of digits) {
    count += factor * d;
    factor = factor === 3 ? 1 : 3;
  }
  return (10 - (count % 10)) % 10;
}

/**
 * Encodes a GTIN as a GS1 DataBar Omnidirectional module bit string ('1' = black module, '0' =
 * white module), 96 modules wide including its own leading/trailing guard, no quiet zone. Accepts
 * 1-14 digits: a leading `(01)`/`01` AI prefix is stripped if present, a 14-digit value is
 * validated as GTIN + check digit, and anything shorter than 13 digits is left-zero-padded up to
 * 13 (P-touch's own RSS entry, e.g. `lengths="12"`, takes an item reference shorter than the full
 * GTIN body and left-pads it the same way).
 */
export function encodeGs1DataBar(data: string): string {
  let digits = data.replace(/^\(01\)|^01(?=\d{13,14}$)/, '');
  if (!/^[0-9]{1,14}$/.test(digits)) throw new Error(`node-lbx: GS1 DataBar requires 1-14 digits, got ${JSON.stringify(data)}`);
  if (digits.length < 13) digits = digits.padStart(13, '0');

  const digitValues = Array.from(digits, Number);
  if (digitValues.length === 14) {
    const expected = gs1CheckDigit(digitValues.slice(0, 13));
    if (digitValues[13] !== expected) throw new Error(`node-lbx: GS1 DataBar check digit mismatch (got ${digitValues[13]}, expected ${expected})`);
    digitValues.pop();
  }

  let val = 0;
  for (const d of digitValues) val = val * 10 + d;

  const leftPair = Math.floor(val / 4537077);
  const rightPair = val % 4537077;
  const dataCharacter = [Math.floor(leftPair / 1597), leftPair % 1597, Math.floor(rightPair / 1597), rightPair % 1597];

  const dataWidths: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const outside = i % 2 === 0;
    const g = group(dataCharacter[i]!, outside);
    const v = dataCharacter[i]! - G_SUM[g]!;
    const vDiv = Math.floor(v / T_EVEN_ODD[g]!);
    const vMod = v % T_EVEN_ODD[g]!;
    const noNarrow = i % 2 === 1;
    dataWidths.push(widthsInterleaved(outside ? vDiv : vMod, i % 2 === 1 ? vDiv : vMod, MODULES[g]!, MODULES[g + 9]!, 4, WIDEST[g]!, noNarrow));
  }

  let checksum = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) checksum += CHECKSUM_WEIGHT[i]![j]! * dataWidths[i]![j]!;
  checksum %= 79;
  if (checksum >= 8) checksum++;
  if (checksum >= 72) checksum++;
  const cLeft = Math.floor(checksum / 9);
  const cRight = checksum % 9;

  const totalWidths = new Array<number>(46);
  totalWidths[0] = 1;
  totalWidths[1] = 1;
  totalWidths[44] = 1;
  totalWidths[45] = 1;
  for (let i = 0; i < 8; i++) {
    totalWidths[i + 2] = dataWidths[0]![i]!;
    totalWidths[i + 15] = dataWidths[1]![7 - i]!;
    totalWidths[i + 23] = dataWidths[3]![i]!;
    totalWidths[i + 36] = dataWidths[2]![7 - i]!;
  }
  for (let i = 0; i < 5; i++) {
    totalWidths[i + 10] = FINDER_PATTERN[cLeft]![i]!;
    totalWidths[i + 31] = FINDER_PATTERN[cRight]![4 - i]!;
  }

  let bits = '';
  let isBar = false; // the symbol's own leading element (a single quiet-adjacent module) is light
  for (const w of totalWidths) {
    bits += (isBar ? '1' : '0').repeat(w);
    isBar = !isBar;
  }
  return bits;
}
