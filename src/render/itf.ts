/**
 * Interleaved 2 of 5 (ITF) encoder. Ported from JsBarcode's `ITF` module (MIT licensed): each
 * digit has a 5-element wide/narrow pattern, and digits are interleaved in bar/space pairs (odd
 * digit's pattern drawn as bars, even digit's pattern drawn as the spaces between them).
 */
const START = '1010';
const STOP = '11101';

// Each entry: 5 flags (1 = wide element, 0 = narrow element) for that digit, 0-9.
const PATTERNS: readonly string[] = ['00110', '10001', '01001', '11000', '00101', '10100', '01100', '00011', '10010', '01010'];

function encodePair(barDigit: string, spaceDigit: string): string {
  const bars = PATTERNS[Number(barDigit)]!;
  const spaces = PATTERNS[Number(spaceDigit)]!;
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += bars[i] === '1' ? '111' : '1';
    result += spaces[i] === '1' ? '000' : '0';
  }
  return result;
}

/**
 * Encodes a digit string as an ITF module bit string, no quiet zone. ITF encodes digits in
 * bar/space pairs, so an odd-length input is zero-padded on the left (matching common ITF/ITF-14
 * practice); throws on non-digit input.
 */
export function encodeITF(data: string): string {
  if (!/^[0-9]+$/.test(data)) throw new Error('node-lbx: ITF data must be digits only');
  const padded = data.length % 2 === 0 ? data : `0${data}`;

  let result = START;
  for (let i = 0; i < padded.length; i += 2) {
    result += encodePair(padded[i]!, padded[i + 1]!);
  }
  return result + STOP;
}
