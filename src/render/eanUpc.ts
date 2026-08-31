/**
 * EAN-13, EAN-8, UPC-A, UPC-E, and the EAN-2/EAN-5 supplement encoders. Tables and structure
 * arrays ported from JsBarcode's `EAN_UPC` module (MIT licensed) — every digit pattern is the
 * universal, standard EAN/UPC 7-module table (same numbers found in the EAN spec / Wikipedia).
 * JAN-13/JAN-8 (P-touch's Japanese Article Number protocols) are the same symbology as EAN-13/
 * EAN-8, so they share these encoders.
 */

const SIDE = '101';
const MIDDLE = '01010';

const L: readonly string[] = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G: readonly string[] = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R: readonly string[] = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];

const EAN13_STRUCTURE: readonly string[] = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const EAN2_STRUCTURE: readonly string[] = ['LL', 'LG', 'GL', 'GG'];
const EAN5_STRUCTURE: readonly string[] = ['GGLLL', 'GLGLL', 'GLLGL', 'GLLLG', 'LGGLL', 'LLGGL', 'LLLGG', 'LGLGL', 'LGLLG', 'LLGLG'];

function digitsOf(data: string): number[] {
  return Array.from(data, Number);
}

function encodeSide(data: string, structure: string, table: { L: readonly string[]; G: readonly string[]; R: readonly string[] }): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const side = structure[i] as 'L' | 'G' | 'R';
    result += table[side]![Number(data[i])];
  }
  return result;
}

function requireDigits(data: string, length: number, name: string): void {
  if (!new RegExp(`^[0-9]{${length}}$`).test(data)) throw new Error(`node-lbx: ${name} requires exactly ${length} digits, got ${JSON.stringify(data)}`);
}

function ean13Checksum(digits: number[]): number {
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

function ean8Checksum(digits: number[]): number {
  const sum = digits.slice(0, 7).reduce((acc, d, i) => acc + d * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function upcaChecksum(digits: number[]): number {
  let sum = 0;
  for (let i = 1; i < 11; i += 2) sum += digits[i]!;
  for (let i = 0; i < 11; i += 2) sum += digits[i]! * 3;
  return (10 - (sum % 10)) % 10;
}

/** Encodes 12 or 13 digits (checksum computed if 12 given) as an EAN-13 module bit string, no quiet zone. */
export function encodeEAN13(data: string): string {
  let digits = digitsOf(data);
  if (digits.length === 12) digits = [...digits, ean13Checksum(digits)];
  requireDigits(digits.join(''), 13, 'EAN-13');

  const structure = EAN13_STRUCTURE[digits[0]!]!;
  const left = encodeSide(digits.slice(1, 7).join(''), structure, { L, G, R });
  const right = encodeSide(digits.slice(7, 13).join(''), 'RRRRRR', { L, G, R });
  return SIDE + left + MIDDLE + right + SIDE;
}

/** Encodes 7 or 8 digits (checksum computed if 7 given) as an EAN-8 module bit string, no quiet zone. */
export function encodeEAN8(data: string): string {
  let digits = digitsOf(data);
  if (digits.length === 7) digits = [...digits, ean8Checksum(digits)];
  requireDigits(digits.join(''), 8, 'EAN-8');

  const left = encodeSide(digits.slice(0, 4).join(''), 'LLLL', { L, G, R });
  const right = encodeSide(digits.slice(4, 8).join(''), 'RRRR', { L, G, R });
  return SIDE + left + MIDDLE + right + SIDE;
}

/** Encodes 11 or 12 digits (checksum computed if 11 given) as a UPC-A module bit string, no quiet zone. */
export function encodeUPCA(data: string): string {
  let digits = digitsOf(data);
  if (digits.length === 11) digits = [...digits, upcaChecksum(digits)];
  requireDigits(digits.join(''), 12, 'UPC-A');

  const left = encodeSide(digits.slice(0, 6).join(''), 'LLLLLL', { L, G, R });
  const right = encodeSide(digits.slice(6, 12).join(''), 'RRRRRR', { L, G, R });
  return SIDE + left + MIDDLE + right + SIDE;
}

const UPCE_EXPANSIONS: readonly string[] = [
  'XX00000XXX', 'XX10000XXX', 'XX20000XXX', 'XXX00000XX', 'XXXX00000X', 'XXXXX00005', 'XXXXX00006', 'XXXXX00007', 'XXXXX00008', 'XXXXX00009',
];

const UPCE_PARITIES: readonly (readonly [string, string])[] = [
  ['EEEOOO', 'OOOEEE'], ['EEOEOO', 'OOEOEE'], ['EEOOEO', 'OOEEOE'], ['EEOOOE', 'OOEEEO'], ['EOEEOO', 'OEOOEE'],
  ['EOOEEO', 'OEEOOE'], ['EOOOEE', 'OEEEOO'], ['EOEOEO', 'OEOEOE'], ['EOEOOE', 'OEOEEO'], ['EOOEOE', 'OEEOEO'],
];

function expandUpcEToUpcA(middleDigits: string, numberSystem: string): string {
  const lastDigit = Number(middleDigits[middleDigits.length - 1]);
  const expansion = UPCE_EXPANSIONS[lastDigit]!;
  let result = '';
  let digitIndex = 0;
  for (const c of expansion) result += c === 'X' ? middleDigits[digitIndex++] : c;
  const withPrefix = numberSystem + result;
  return withPrefix + upcaChecksum(digitsOf(withPrefix));
}

/**
 * Encodes UPC-E. Accepts 6 digits (the UPC-E payload; checksum and number system 0 assumed), or
 * 8 digits (number system + 6-digit payload + checksum, validated against the expanded UPC-A).
 * Returns a module bit string, no quiet zone.
 */
export function encodeUPCE(data: string): string {
  let middleDigits: string;
  let numberSystem: string;
  let upcA: string;

  if (/^[0-9]{6}$/.test(data)) {
    middleDigits = data;
    numberSystem = '0';
    upcA = expandUpcEToUpcA(middleDigits, numberSystem);
  } else if (/^[01][0-9]{7}$/.test(data)) {
    numberSystem = data[0]!;
    middleDigits = data.slice(1, 7);
    upcA = expandUpcEToUpcA(middleDigits, numberSystem);
    if (upcA[upcA.length - 1] !== data[data.length - 1]) {
      throw new Error(`node-lbx: UPC-E checksum mismatch for ${JSON.stringify(data)}`);
    }
  } else {
    throw new Error(`node-lbx: UPC-E requires 6 digits, or 8 digits starting with 0 or 1, got ${JSON.stringify(data)}`);
  }

  const checkDigit = upcA[upcA.length - 1]!;
  const parity = UPCE_PARITIES[Number(checkDigit)]![Number(numberSystem)]!;
  const middle = encodeSide(middleDigits, parity.replace(/E/g, 'G').replace(/O/g, 'L'), { L, G, R });
  return `${SIDE}${middle}010101`;
}

function ean2Checksum(digits: number[]): number {
  return (digits[0]! * 10 + digits[1]!) % 4;
}

/** Encodes a 2-digit EAN-2 supplement as a module bit string (no quiet zone; caller places it after the main symbol's own quiet zone). */
export function encodeEAN2(data: string): string {
  requireDigits(data, 2, 'EAN-2');
  const digits = digitsOf(data);
  const structure = EAN2_STRUCTURE[ean2Checksum(digits)]!;
  const p0 = encodeSide(data[0]!, structure[0]!, { L, G, R });
  const p1 = encodeSide(data[1]!, structure[1]!, { L, G, R });
  return `1011${p0}01${p1}`;
}

function ean5Checksum(digits: number[]): number {
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 ? 9 : 3), 0);
  return sum % 10;
}

/** Encodes a 5-digit EAN-5 supplement (e.g. a book's price add-on) as a module bit string (no quiet zone). */
export function encodeEAN5(data: string): string {
  requireDigits(data, 5, 'EAN-5');
  const digits = digitsOf(data);
  const structure = EAN5_STRUCTURE[ean5Checksum(digits)]!;
  const parts = digits.map((d, i) => encodeSide(String(d), structure[i]!, { L, G, R }));
  return `1011${parts.join('01')}`;
}
