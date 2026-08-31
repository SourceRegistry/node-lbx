/**
 * Decodes uncompressed BMP pixel data into RGBA, and re-encodes as PNG.
 *
 * Why this exists: P-touch Editor exports images as 32bpp `BI_RGB` BMP, and — per an unofficial
 * but common GDI+ convention — repurposes the 4th ("reserved") byte of each pixel as an alpha
 * channel. The BMP spec doesn't define alpha for `BI_RGB`, so browsers correctly ignore that byte
 * and render the pixel's raw (often black) RGB, producing a solid block behind what P-touch shows
 * as a transparent background. Converting to a real PNG alpha channel renders identically to
 * P-touch Editor in any SVG viewer.
 */
import { deflateSync } from 'node:zlib';

interface DecodedBitmap {
  width: number;
  height: number;
  /** Top-down RGBA, 4 bytes per pixel. */
  rgba: Buffer;
}

/** Decodes a 24bpp or 32bpp uncompressed (BI_RGB) BMP. Returns undefined for anything else (RLE, indexed, etc.) — caller should fall back to embedding the original bytes. */
export function decodeBmp(buf: Buffer): DecodedBitmap | undefined {
  if (buf.length < 54 || buf.readUInt16LE(0) !== 0x4d42 /* 'BM' */) return undefined;

  const pixelOffset = buf.readUInt32LE(10);
  const dibHeaderSize = buf.readUInt32LE(14);
  if (dibHeaderSize < 40) return undefined;

  const width = buf.readInt32LE(18);
  const heightRaw = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);
  if (compression !== 0 /* BI_RGB */ || (bpp !== 24 && bpp !== 32)) return undefined;

  const height = Math.abs(heightRaw);
  const bottomUp = heightRaw > 0;
  const bytesPerPixel = bpp / 8;
  const rowSize = Math.ceil((width * bpp) / 32) * 4; // BMP rows are padded to a 4-byte boundary

  if (pixelOffset + rowSize * height > buf.length) return undefined;

  // For 32bpp, decide whether the 4th byte is real alpha (P-touch's convention) or just padding:
  // sample it across the image and only trust it if it actually varies.
  let hasAlpha = false;
  if (bpp === 32) {
    let first = -1;
    for (let row = 0; row < height && !hasAlpha; row += Math.max(1, Math.floor(height / 32))) {
      const rowStart = pixelOffset + row * rowSize;
      for (let col = 0; col < width; col += Math.max(1, Math.floor(width / 32))) {
        const a = buf[rowStart + col * 4 + 3]!;
        if (first === -1) first = a;
        else if (a !== first) {
          hasAlpha = true;
          break;
        }
      }
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = bottomUp ? height - 1 - y : y;
    const rowStart = pixelOffset + srcRow * rowSize;
    let dst = y * width * 4;
    let src = rowStart;
    for (let x = 0; x < width; x++) {
      const b = buf[src]!;
      const g = buf[src + 1]!;
      const r = buf[src + 2]!;
      const a = bpp === 32 && hasAlpha ? buf[src + 3]! : 255;
      rgba[dst] = r;
      rgba[dst + 1] = g;
      rgba[dst + 2] = b;
      rgba[dst + 3] = a;
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

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encodes top-down RGBA pixel data as a minimal (uncompressed-filter, single IDAT) PNG. */
export function encodePng({ width, height, rgba }: DecodedBitmap): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const srcStart = y * width * 4;
    const dstStart = y * (width * 4 + 1);
    raw[dstStart] = 0; // filter type: None
    rgba.copy(raw, dstStart + 1, srcStart, srcStart + width * 4);
  }
  const idatData = deflateSync(raw);

  return Buffer.concat([signature, pngChunk('IHDR', ihdrData), pngChunk('IDAT', idatData), pngChunk('IEND', Buffer.alloc(0))]);
}

/** Converts a BMP buffer to PNG bytes if it's a format we can decode (24/32bpp BI_RGB), else undefined. */
export function bmpToPng(buf: Buffer): Buffer | undefined {
  const decoded = decodeBmp(buf);
  return decoded ? encodePng(decoded) : undefined;
}
