/** MicroPDF417 tables (ISO/IEC 24728:2006), ported from zint's pdf417_tabs.h / pdf417.c. */

/**
 * Field-major, matching zint's `MicroVariants[field][variant]`: MICRO_VARIANTS[0][v] = data
 * columns, [1][v] = rows, [2][v] = EC codewords, for each of the 34 variants (1-4 columns x
 * however many row counts each supports). The generator-polynomial-offset 4th row isn't needed
 * here since the EC generator is computed dynamically (see reedSolomonEncodePdf417).
 */
export const MICRO_VARIANTS: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [11, 14, 17, 20, 24, 28, 8, 11, 14, 17, 20, 23, 26, 6, 8, 10, 12, 15, 20, 26, 32, 38, 44, 4, 6, 8, 10, 12, 15, 20, 26, 32, 38, 44],
  [7, 7, 7, 8, 8, 8, 8, 9, 9, 10, 11, 13, 15, 12, 14, 16, 18, 21, 26, 32, 38, 44, 50, 8, 12, 14, 16, 18, 21, 26, 32, 38, 44, 50],
];

/** Field-major, matching zint's `RAPTable[field][variant]`: [0][v] = left RAP (1-based index), [1][v] = centre RAP, [2][v] = right RAP, [3][v] = starting cluster (already 0/1/2, not 0/3/6). */
export const RAP_TABLE: readonly (readonly number[])[] = [
  [1, 8, 36, 19, 9, 25, 1, 1, 8, 36, 19, 9, 27, 1, 7, 15, 25, 37, 1, 1, 21, 15, 1, 47, 1, 7, 15, 25, 37, 1, 1, 21, 15, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 15, 25, 37, 17, 9, 29, 31, 25, 19, 1, 7, 15, 25, 37, 17, 9, 29, 31, 25],
  [9, 8, 36, 19, 17, 33, 1, 9, 8, 36, 19, 17, 35, 1, 7, 15, 25, 37, 33, 17, 37, 47, 49, 43, 1, 7, 15, 25, 37, 33, 17, 37, 47, 49],
  [0, 1, 2, 0, 2, 0, 0, 0, 1, 2, 0, 2, 2, 0, 0, 2, 0, 0, 0, 0, 2, 2, 0, 1, 0, 0, 2, 0, 0, 0, 0, 2, 2, 0],
];

/** Left/Right Row Address Pattern, 10-bit values. */
export const RAP_SIDE: readonly number[] = [
  0x322, 0x3A2, 0x3B2, 0x332, 0x372, 0x37A, 0x33A, 0x3BA, 0x39A, 0x3DA,
  0x3CA, 0x38A, 0x30A, 0x31A, 0x312, 0x392, 0x3D2, 0x3D6, 0x3D4, 0x394,
  0x3B4, 0x3A4, 0x3A6, 0x3AE, 0x3AC, 0x3A8, 0x328, 0x32C, 0x32E, 0x326,
  0x336, 0x3B6, 0x396, 0x316, 0x314, 0x334, 0x374, 0x364, 0x366, 0x36E,
  0x36C, 0x368, 0x348, 0x358, 0x35C, 0x35E, 0x34E, 0x34C, 0x344, 0x346,
  0x342, 0x362,
];

/** Centre Row Address Pattern, 10-bit values. */
export const RAP_CENTRE: readonly number[] = [
  0x2CE, 0x24E, 0x26E, 0x22E, 0x226, 0x236, 0x216, 0x212, 0x21A, 0x23A,
  0x232, 0x222, 0x262, 0x272, 0x27A, 0x2FA, 0x2F2, 0x2F6, 0x276, 0x274,
  0x264, 0x266, 0x246, 0x242, 0x2C2, 0x2E2, 0x2E6, 0x2E4, 0x2EC, 0x26C,
  0x22C, 0x228, 0x268, 0x2E8, 0x2C8, 0x2CC, 0x2C4, 0x2C6, 0x286, 0x28E,
  0x28C, 0x29C, 0x298, 0x2B8, 0x2B0, 0x290, 0x2D0, 0x250, 0x258, 0x25C,
  0x2DC, 0x2DE,
];

/** Auto-size lookup: ascending max non-EC codeword counts (first 28) mapped to their variant number, 1-based (last 28). */
export const MICRO_AUTOSIZE_THRESHOLDS: readonly number[] = [4, 6, 7, 8, 10, 12, 13, 14, 16, 18, 19, 20, 24, 29, 30, 33, 34, 37, 39, 46, 54, 58, 70, 72, 82, 90, 108, 126];
export const MICRO_AUTOSIZE_VARIANTS: readonly number[] = [1, 14, 2, 7, 3, 25, 8, 16, 5, 17, 9, 6, 10, 11, 28, 12, 19, 13, 29, 20, 30, 21, 22, 31, 23, 32, 33, 34];