/**
 * Decodes uncompressed BMP pixel data into RGBA, and re-encodes as PNG.
 *
 * P-touch Editor puts alpha in the reserved byte of 32bpp BI_RGB pixels. Browsers ignore that
 * byte when displaying BMP, so conversion to PNG is needed for a faithful preview.
 */
import { zlibSync } from 'fflate';

interface DecodedBitmap {
  width: number;
  height: number;
  /** Top-down RGBA, 4 bytes per pixel. */
  rgba: Uint8Array;
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** Decodes a 24bpp or 32bpp uncompressed (BI_RGB) BMP. */
export function decodeBmp(buf: Uint8Array): DecodedBitmap | undefined {
  if (buf.length < 54) return undefined;
  const view = viewOf(buf);
  if (view.getUint16(0, true) !== 0x4d42) return undefined;

  const pixelOffset = view.getUint32(10, true);
  const dibHeaderSize = view.getUint32(14, true);
  if (dibHeaderSize < 40) return undefined;

  const width = view.getInt32(18, true);
  const heightRaw = view.getInt32(22, true);
  const bpp = view.getUint16(28, true);
  const compression = view.getUint32(30, true);
  if (width <= 0 || heightRaw === 0 || compression !== 0 || (bpp !== 24 && bpp !== 32)) return undefined;

  const height = Math.abs(heightRaw);
  const bottomUp = heightRaw > 0;
  const bytesPerPixel = bpp / 8;
  const rowSize = Math.ceil((width * bpp) / 32) * 4;
  if (pixelOffset + rowSize * height > buf.length) return undefined;

  let hasAlpha = false;
  if (bpp === 32) {
    let first = -1;
    for (let row = 0; row < height && !hasAlpha; row += Math.max(1, Math.floor(height / 32))) {
      const rowStart = pixelOffset + row * rowSize;
      for (let col = 0; col < width; col += Math.max(1, Math.floor(width / 32))) {
        const alpha = buf[rowStart + col * 4 + 3]!;
        if (first === -1) first = alpha;
        else if (alpha !== first) {
          hasAlpha = true;
          break;
        }
      }
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = bottomUp ? height - 1 - y : y;
    let src = pixelOffset + srcRow * rowSize;
    let dst = y * width * 4;
    for (let x = 0; x < width; x++) {
      rgba[dst] = buf[src + 2]!;
      rgba[dst + 1] = buf[src + 1]!;
      rgba[dst + 2] = buf[src]!;
      rgba[dst + 3] = bpp === 32 && hasAlpha ? buf[src + 3]! : 255;
      dst += 4;
      src += bytesPerPixel;
    }
  }

  return { width, height, rgba };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (char) => char.charCodeAt(0));
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeAndData = concatBytes([asciiBytes(type), data]);
  return concatBytes([uint32(data.length), typeAndData, uint32(crc32(typeAndData))]);
}

/** Encodes top-down RGBA pixel data as a minimal PNG. */
export function encodePng({ width, height, rgba }: DecodedBitmap): Uint8Array {
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdrData[8] = 8;
  ihdrData[9] = 6;

  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const srcStart = y * width * 4;
    const dstStart = y * (width * 4 + 1);
    raw[dstStart] = 0;
    raw.set(rgba.subarray(srcStart, srcStart + width * 4), dstStart + 1);
  }

  return concatBytes([signature, pngChunk('IHDR', ihdrData), pngChunk('IDAT', zlibSync(raw)), pngChunk('IEND', new Uint8Array())]);
}

export function bmpToPng(buf: Uint8Array): Uint8Array | undefined {
  const decoded = decodeBmp(buf);
  return decoded ? encodePng(decoded) : undefined;
}
