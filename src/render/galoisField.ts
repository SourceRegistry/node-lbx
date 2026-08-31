/**
 * GF(256) arithmetic and Reed-Solomon error-correction encoding, shared by QR Code and Data
 * Matrix (they use different primitive polynomials for the same field size, and different
 * generator-polynomial starting roots — both are parameters here).
 */
export class GF256 {
  private readonly exp: Uint8Array;
  private readonly log: Uint8Array;

  constructor(primitive: number) {
    this.exp = new Uint8Array(256);
    this.log = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      this.exp[i] = x;
      this.log[x] = i;
      x <<= 1;
      if (x >= 256) x ^= primitive;
    }
  }

  mul(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    return this.exp[(this.log[a]! + this.log[b]!) % 255]!;
  }

  /** Reed-Solomon generator polynomial of degree `numEc`, highest power first, leading 1 dropped. */
  private generatorCoefficients(numEc: number, firstRoot: number): number[] {
    let poly = [1];
    for (let i = 0; i < numEc; i++) {
      const alphaI = this.exp[(firstRoot + i) % 255]!;
      const next = [...poly, 0];
      for (let j = 0; j < poly.length; j++) next[j + 1]! ^= this.mul(poly[j]!, alphaI);
      poly = next;
    }
    return poly.slice(1);
  }

  /** Returns `numEc` Reed-Solomon error-correction bytes for `data` (highest power first). */
  encode(data: number[], numEc: number, firstRoot = 0): number[] {
    const gen = this.generatorCoefficients(numEc, firstRoot);
    const buffer = [...data, ...new Array<number>(numEc).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const lead = buffer[i]!;
      if (lead !== 0) {
        for (let j = 0; j < numEc; j++) buffer[i + 1 + j]! ^= this.mul(lead, gen[j]!);
      }
    }
    return buffer.slice(data.length);
  }
}

/** QR Code's field: x^8 + x^4 + x^3 + x^2 + 1. */
export const GF256_QR = new GF256(0x11d);
/** Data Matrix (ECC200)'s field: x^8 + x^5 + x^3 + x^2 + 1. */
export const GF256_DATAMATRIX = new GF256(0x12d);
