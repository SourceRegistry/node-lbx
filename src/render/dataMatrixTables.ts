/** ECC200 symbol sizes (ISO/IEC 16022): all 24 square sizes plus all 6 rectangular sizes. */
export interface DataMatrixSpec {
  dataWords: number;
  errorWords: number;
  rsBlocks: number;
  /** Height/width of one data region, excluding its finder border. Square specs use the same value for both. */
  regionRows: number;
  regionCols: number;
  /** How many regions tile the symbol horizontally/vertically. */
  hRegions: number;
  vRegions: number;
  shape: 'square' | 'rectangular';
}

const DATA_WORD_LENGTH: readonly number[] = [
  3, 5, 8, 12, 18, 22, 30, 36, 44, 62, 86, 114, 144, 174, 204, 280, 368, 456, 576, 696, 816, 1050, 1304, 1558,
];
const ERROR_WORD_LENGTH: readonly number[] = [
  5, 7, 10, 12, 14, 18, 20, 24, 28, 36, 42, 48, 56, 68, 84, 112, 144, 192, 224, 272, 336, 408, 496, 620,
];
const DATA_REGION_SIZE: readonly number[] = [
  8, 10, 12, 14, 16, 18, 20, 22, 24, 14, 16, 18, 20, 22, 24, 14, 16, 18, 20, 22, 24, 18, 20, 22,
];
const HV_REGIONS: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 6, 6, 6];
const RS_BLOCKS: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 4, 4, 4, 4, 6, 6, 8, 10];

export const SQUARE_SPECS: readonly DataMatrixSpec[] = DATA_WORD_LENGTH.map((dataWords, i) => ({
  dataWords,
  errorWords: ERROR_WORD_LENGTH[i]!,
  rsBlocks: RS_BLOCKS[i]!,
  regionRows: DATA_REGION_SIZE[i]!,
  regionCols: DATA_REGION_SIZE[i]!,
  hRegions: HV_REGIONS[i]!,
  vRegions: HV_REGIONS[i]!,
  shape: 'square',
}));

// [dataWords, errorWords, rsBlocks, regionRows, regionCols, hRegions, vRegions] — symbol sizes in the
// comments are the rendered module dimensions (rows x cols), not the region dimensions.
const RECT_SPEC_ROWS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [5, 7, 1, 6, 16, 1, 1], // 8x18
  [10, 11, 1, 6, 14, 2, 1], // 8x32
  [16, 14, 1, 10, 24, 1, 1], // 12x26
  [22, 18, 1, 10, 16, 2, 1], // 12x36
  [32, 24, 1, 14, 16, 2, 1], // 16x36
  [49, 28, 1, 14, 22, 2, 1], // 16x48
];

export const RECT_SPECS: readonly DataMatrixSpec[] = RECT_SPEC_ROWS.map(([dataWords, errorWords, rsBlocks, regionRows, regionCols, hRegions, vRegions]) => ({
  dataWords,
  errorWords,
  rsBlocks,
  regionRows,
  regionCols,
  hRegions,
  vRegions,
  shape: 'rectangular',
}));

/** All 30 ECC200 sizes, square first then rectangular (both already sorted smallest to largest data capacity within their group). */
export const DATA_MATRIX_SPECS: readonly DataMatrixSpec[] = [...SQUARE_SPECS, ...RECT_SPECS];
