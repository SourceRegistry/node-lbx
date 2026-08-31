/**
 * USPS Intelligent Mail Barcode (IMb, formerly "OneCode") encoder — USPS-B-3200. Ported from
 * zint's `imail.c` (BSD-3-Clause; the CRC11 routine carries a separate USPS copyright notice).
 * Input format matches zint's: a 20-digit tracking code, optionally followed by `-` and a 5, 9,
 * or 11 digit ZIP routing code (e.g. `"01234567094987654321-01234567891"`).
 */
import { APPX_D_I, APPX_D_II, APPX_D_IV } from './imbTables.js';

const CRC11_POLY = 0x0f35;
const CRC11_INIT = 0x07ff;

function crc11(bytes: number[]): number {
  let fcs = CRC11_INIT;

  let data = (bytes[0]! << 5) & 0xffff;
  for (let bit = 2; bit < 8; bit++) {
    fcs = (fcs ^ data) & 0x400 ? ((fcs << 1) ^ CRC11_POLY) & 0x7ff : (fcs << 1) & 0x7ff;
    data = (data << 1) & 0xffff;
  }
  for (let i = 1; i < 13; i++) {
    let d = (bytes[i]! << 3) & 0xffff;
    for (let bit = 0; bit < 8; bit++) {
      fcs = (fcs ^ d) & 0x400 ? ((fcs << 1) ^ CRC11_POLY) & 0x7ff : (fcs << 1) & 0x7ff;
      d = (d << 1) & 0xffff;
    }
  }
  return fcs;
}

function toBigEndianBytes(value: bigint, numBytes: number): number[] {
  const bytes = new Array<number>(numBytes);
  let v = value;
  for (let i = numBytes - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

/**
 * Encodes an IMb tracking/routing code into the "4-state" bar pattern, one character per bar:
 * 'F' full (ascender + descender), 'A' ascender only, 'D' descender only, 'T' tracker (neither —
 * short middle-only bar). 65 bars, no quiet zone. Throws on malformed input.
 */
export function encodeImb(data: string): string {
  const dashIndex = data.indexOf('-');
  const tracker = dashIndex === -1 ? data : data.slice(0, dashIndex);
  const zip = dashIndex === -1 ? '' : data.slice(dashIndex + 1);

  if (!/^[0-9]{20}$/.test(tracker)) throw new Error(`node-lbx: IMb tracking code must be 20 digits, got ${JSON.stringify(tracker)}`);
  if (tracker[1]! > '4') throw new Error('node-lbx: IMb Barcode Identifier (2nd digit) must be 0-4');
  if (zip !== '' && ![5, 9, 11].includes(zip.length)) throw new Error(`node-lbx: IMb ZIP code must be 5, 9, or 11 digits, got ${JSON.stringify(zip)}`);
  if (zip !== '' && !/^[0-9]+$/.test(zip)) throw new Error(`node-lbx: IMb ZIP code must be digits only, got ${JSON.stringify(zip)}`);

  let accum = zip === '' ? 0n : BigInt(zip);
  if (zip.length > 9) accum += 1000100001n;
  else if (zip.length > 5) accum += 100001n;
  else if (zip.length > 0) accum += 1n;

  accum = accum * 10n + BigInt(tracker[0]!);
  accum = accum * 5n + BigInt(tracker[1]!);
  for (let i = 2; i < 20; i++) accum = accum * 10n + BigInt(tracker[i]!);

  const crcInput = accum & ((1n << 102n) - 1n); // clear bits 102/103 (top 2 bits of the 13-byte, 104-bit field)
  const uspsCrc = crc11(toBigEndianBytes(crcInput, 13));

  const codeword = new Array<number>(10);
  codeword[9] = Number(accum % 636n);
  accum /= 636n;
  for (let j = 8; j > 0; j--) {
    codeword[j] = Number(accum % 1365n);
    accum /= 1365n;
  }
  codeword[0] = Number(accum);

  codeword[9]! *= 2;
  if (uspsCrc >= 1024) codeword[0]! += 659;

  const characters = codeword.map((cw) => (cw < 1287 ? APPX_D_I[cw]! : APPX_D_II[cw - 1287]!));
  for (let i = 0; i < 10; i++) {
    if (uspsCrc & (1 << i)) characters[i] = 0x1fff - characters[i]!;
  }

  const barMap = new Array<number>(130);
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 13; j++) {
      barMap[APPX_D_IV[13 * i + j]! - 1] = (characters[i]! >> j) & 1;
    }
  }

  let pattern = '';
  for (let i = 0; i < 65; i++) {
    let j = 0;
    if (barMap[i] === 0) j += 1;
    if (barMap[i + 65] === 0) j += 2;
    pattern += j === 0 ? 'F' : j === 1 ? 'A' : j === 2 ? 'D' : 'T';
  }
  return pattern;
}
