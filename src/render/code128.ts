/**
 * Code 128 (Set B) encoder — produces the actual scannable bar/space pattern for a data string,
 * not a decorative approximation. Set B covers ASCII 32-126 (space through `~`), which is every
 * character P-touch's barcode objects realistically carry (SKUs, ISBNs, alphanumeric codes).
 * Doesn't attempt Set C digit-pair compaction; a Set-B-only symbol is longer than an optimally
 * mixed one but decodes identically to any Code 128 scanner.
 */

// Module widths (bar,space,bar,space,bar,space — 11 modules) for symbol values 0-102, then
// START A/B/C (103/104/105) and STOP (106, 13 modules: the stop pattern plus its trailing bar).
const PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const FNC1 = 102;
const STOP = 106;

function widthsFromCodes(codes: number[]): number[] {
  const widths: number[] = [];
  for (const code of codes) {
    for (const digit of PATTERNS[code]!) widths.push(Number(digit));
  }
  return widths;
}

/**
 * Returns the symbol's module widths (alternating bar/space, starting with a bar — no quiet zone
 * included). Throws if `data` contains a character outside Code 128 Set B (ASCII 32-126).
 */
export function encodeCode128B(data: string): number[] {
  const codes: number[] = [START_B];
  for (const ch of data) {
    const code = ch.charCodeAt(0) - 32;
    if (code < 0 || code > 95) {
      throw new Error(`node-lbx: character ${JSON.stringify(ch)} is outside Code 128 Set B (ASCII 32-126)`);
    }
    codes.push(code);
  }

  let checksum = codes[0]!;
  for (let i = 1; i < codes.length; i++) checksum += i * codes[i]!;
  codes.push(checksum % 103, STOP);

  return widthsFromCodes(codes);
}

/**
 * Encodes GS1-128 (UCC/EAN-128) data as Code 128 Set B with a leading FNC1 — the symbol-level
 * flag that tells a GS1 scanner "this is a GS1 symbol". Any ASCII 0x1D (GS) characters in `data`
 * — the conventional way to spell an in-band GS1 field separator in plain text — are encoded as
 * another FNC1 codeword, which is what a GS1 field separator actually is on the wire.
 */
export function encodeGS1_128(data: string): number[] {
  const codes: number[] = [START_B, FNC1];
  for (const ch of data) {
    if (ch === '\x1d') {
      codes.push(FNC1);
      continue;
    }
    const code = ch.charCodeAt(0) - 32;
    if (code < 0 || code > 95) {
      throw new Error(`node-lbx: character ${JSON.stringify(ch)} is outside Code 128 Set B (ASCII 32-126)`);
    }
    codes.push(code);
  }

  let checksum = codes[0]!;
  for (let i = 1; i < codes.length; i++) checksum += i * codes[i]!;
  codes.push(checksum % 103, STOP);

  return widthsFromCodes(codes);
}
