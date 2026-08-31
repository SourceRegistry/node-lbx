/**
 * Code 39 encoder. Table cross-checked against the `python-barcode` reference implementation
 * (`barcode.charsets.code39`) — each entry is the literal per-module bar/space bit string
 * ('1' = black module, '0' = white module) for one of the 43 symbols, all 15 modules wide.
 */
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';

const CODES: readonly string[] = [
  '101000111011101', '111010001010111', '101110001010111', '111011100010101', '101000111010111',
  '111010001110101', '101110001110101', '101000101110111', '111010001011101', '101110001011101',
  '111010100010111', '101110100010111', '111011101000101', '101011100010111', '111010111000101',
  '101110111000101', '101010001110111', '111010100011101', '101110100011101', '101011100011101',
  '111010101000111', '101110101000111', '111011101010001', '101011101000111', '111010111010001',
  '101110111010001', '101010111000111', '111010101110001', '101110101110001', '101011101110001',
  '111000101010111', '100011101010111', '111000111010101', '100010111010111', '111000101110101',
  '100011101110101', '100010101110111', '111000101011101', '100011101011101', '100010001000101',
  '100010001010001', '100010100010001', '101000100010001',
];

const EDGE = '100010111011101'; // start/stop '*'
const GAP = '0'; // narrow inter-character space

function checksum(data: string): string {
  let sum = 0;
  for (const ch of data) sum += CHARS.indexOf(ch);
  return CHARS[sum % 43]!;
}

/** Encodes `data` (0-9, A-Z, `-. $/+%`) as a Code 39 module bit string, no quiet zone. `data` is upper-cased; throws on any other character. */
export function encodeCode39(data: string, opts: { checksum?: boolean } = {}): string {
  const upper = data.toUpperCase();
  for (const ch of upper) {
    if (!CHARS.includes(ch)) throw new Error(`node-lbx: character ${JSON.stringify(ch)} is outside Code 39's symbol set`);
  }
  const full = opts.checksum ? upper + checksum(upper) : upper;

  const parts = [EDGE, ...Array.from(full, (ch) => CODES[CHARS.indexOf(ch)]!), EDGE];
  return parts.join(GAP);
}
