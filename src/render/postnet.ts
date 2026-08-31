/**
 * USPS POSTNET encoder. Each digit is 5 bars, of which exactly 2 are "full" height and 3 are
 * "half" height, chosen by a standard weight table [7,4,2,1,0] (digit 0 is a reserved special
 * case, not derivable from the weights). A mod-10 checksum digit is appended so the sum of all
 * digits (including it) is a multiple of 10, then the whole thing is framed by a full-height bar
 * on each end.
 */
const DIGIT_PATTERNS: readonly string[] = [
  '11000', '00011', '00101', '00110', '01001',
  '01010', '01100', '10001', '10010', '10100',
];

function checksum(digits: number[]): number {
  const sum = digits.reduce((a, b) => a + b, 0);
  return (10 - (sum % 10)) % 10;
}

/**
 * Returns the bar pattern as a string of 'T' (tall/full height) and 'S' (short/half height) bars,
 * one per bar, framed by a leading and trailing 'T'. Throws on non-digit input.
 */
export function encodePostnet(data: string): string {
  if (!/^[0-9]+$/.test(data)) throw new Error('node-lbx: POSTNET data must be digits only');
  const digits = Array.from(data, Number);
  digits.push(checksum(digits));

  const bars = digits.map((d) => DIGIT_PATTERNS[d]!.replace(/1/g, 'T').replace(/0/g, 'S')).join('');
  return `T${bars}T`;
}
