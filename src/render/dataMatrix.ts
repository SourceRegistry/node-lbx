/**
 * Data Matrix (ECC200) encoder — ASCII mode only (ISO/IEC 16022's default/base encodation
 * scheme). Digit pairs still pack two-per-codeword (a free, low-risk win baked into the ASCII
 * mode itself), but the C40/Text/X12/EDIFACT/Base256 compaction schemes aren't implemented —
 * same "always correct, not always smallest" tradeoff made throughout this renderer. All 24
 * square sizes and all 6 rectangular sizes defined by the spec are supported (see `DataMatrixShape`).
 *
 * The codeword-to-module placement algorithm (the "diagonal snake" with its four special corner
 * cases) is notoriously easy to get subtly wrong, so `placeCodewords` below follows the standard
 * reference algorithm's structure and corner-case geometry exactly, verified against a real
 * Data Matrix decoder (see the render/svg.ts barcode verification).
 */
import { GF256_DATAMATRIX } from './galoisField.js';
import { SQUARE_SPECS, RECT_SPECS, DATA_MATRIX_SPECS, type DataMatrixSpec } from './dataMatrixTables.js';

export type DataMatrixShape = 'square' | 'rectangular' | 'auto';

export interface DataMatrixOptions {
  /**
   * 'square' or 'rectangular' pin the symbol to that family (smallest fitting size within it);
   * 'auto' (the default) picks whichever fitting size — of either family — has the smallest
   * total rendered area, preferring square on an exact tie (matches BWIPP's "auto" behavior,
   * and squares are the more universally-recognized shape for decoders).
   */
  shape?: DataMatrixShape;
}

/** Total rendered module count (data regions + their finder borders + inter-region gaps), used to compare symbol sizes when `shape` is 'auto'. */
function totalArea(spec: DataMatrixSpec): number {
  return (spec.regionRows + 2) * spec.vRegions * ((spec.regionCols + 2) * spec.hRegions);
}

function selectSpec(dataWordsNeeded: number, shape: DataMatrixShape): DataMatrixSpec {
  if (shape === 'square') {
    const spec = SQUARE_SPECS.find((s) => s.dataWords >= dataWordsNeeded);
    if (!spec) throw new Error(`node-lbx: Data Matrix data too long for any square symbol (${dataWordsNeeded} codewords)`);
    return spec;
  }
  if (shape === 'rectangular') {
    const spec = RECT_SPECS.find((s) => s.dataWords >= dataWordsNeeded);
    if (!spec) throw new Error(`node-lbx: Data Matrix data too long for any rectangular symbol (${dataWordsNeeded} codewords)`);
    return spec;
  }
  const fitting = DATA_MATRIX_SPECS.filter((s) => s.dataWords >= dataWordsNeeded);
  if (fitting.length === 0) throw new Error(`node-lbx: Data Matrix data too long for any ECC200 symbol (${dataWordsNeeded} codewords)`);
  return fitting.reduce((best, cur) => {
    const curArea = totalArea(cur);
    const bestArea = totalArea(best);
    if (curArea < bestArea) return cur;
    if (curArea === bestArea && cur.shape === 'square' && best.shape !== 'square') return cur;
    return best;
  });
}

/** ASCII-mode codewords: digit pairs pack into one codeword; bytes > 127 use Upper Shift. */
function packAscii(bytes: Buffer): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    const next = bytes[i + 1];
    if (next !== undefined && b >= 0x30 && b <= 0x39 && next >= 0x30 && next <= 0x39) {
      out.push(130 + (b - 0x30) * 10 + (next - 0x30));
      i += 2;
    } else if (b > 127) {
      out.push(235, b - 127);
      i += 1;
    } else {
      out.push(b + 1);
      i += 1;
    }
  }
  return out;
}

function randomisePad(position: number): number {
  const pseudoRandom = ((149 * position) % 253) + 1;
  const temp = 129 + pseudoRandom;
  return temp <= 254 ? temp : temp - 254;
}

type Cell = number | null;

/** Places `bit` at (row, col), wrapping negative coordinates around per the ECC200 snake's edge rule. */
function placeBit(matrix: Cell[][], rows: number, cols: number, row: number, col: number, bit: number, record?: [number, number][]): void {
  let r = row;
  let c = col;
  if (r < 0) {
    r += rows;
    c += 4 - ((rows + 4) % 8);
  }
  if (c < 0) {
    c += cols;
    r += 4 - ((cols + 4) % 8);
  }
  matrix[r]![c] = bit;
  record?.push([r, c]);
}

function placeStandardShape(matrix: Cell[][], rows: number, cols: number, row: number, col: number, record?: [number, number][]): void {
  if (matrix[row]![col] !== null) return;
  const bits: [number, number][] = [
    [row - 2, col - 2],
    [row - 2, col - 1],
    [row - 1, col - 2],
    [row - 1, col - 1],
    [row - 1, col - 0],
    [row - 0, col - 2],
    [row - 0, col - 1],
    [row - 0, col - 0],
  ];
  for (const [r, c] of bits) placeBit(matrix, rows, cols, r, c, 0, record);
}

function placeSpecial1(matrix: Cell[][], rows: number, cols: number, record?: [number, number][]): void {
  const p: [number, number][] = [
    [rows - 1, 0],
    [rows - 1, 1],
    [rows - 1, 2],
    [0, cols - 2],
    [0, cols - 1],
    [1, cols - 1],
    [2, cols - 1],
    [3, cols - 1],
  ];
  for (const [r, c] of p) placeBit(matrix, rows, cols, r, c, 0, record);
}

function placeSpecial2(matrix: Cell[][], rows: number, cols: number, record?: [number, number][]): void {
  const p: [number, number][] = [
    [rows - 3, 0],
    [rows - 2, 0],
    [rows - 1, 0],
    [0, cols - 4],
    [0, cols - 3],
    [0, cols - 2],
    [0, cols - 1],
    [1, cols - 1],
  ];
  for (const [r, c] of p) placeBit(matrix, rows, cols, r, c, 0, record);
}

function placeSpecial3(matrix: Cell[][], rows: number, cols: number, record?: [number, number][]): void {
  const p: [number, number][] = [
    [rows - 3, 0],
    [rows - 2, 0],
    [rows - 1, 0],
    [0, cols - 2],
    [0, cols - 1],
    [1, cols - 1],
    [2, cols - 1],
    [3, cols - 1],
  ];
  for (const [r, c] of p) placeBit(matrix, rows, cols, r, c, 0, record);
}

function placeSpecial4(matrix: Cell[][], rows: number, cols: number, record?: [number, number][]): void {
  const p: [number, number][] = [
    [rows - 1, 0],
    [rows - 1, cols - 1],
    [0, cols - 3],
    [0, cols - 2],
    [0, cols - 1],
    [1, cols - 3],
    [1, cols - 2],
    [1, cols - 1],
  ];
  for (const [r, c] of p) placeBit(matrix, rows, cols, r, c, 0, record);
}

/** Runs the ECC200 diagonal-snake traversal once to record which 8 cells carry each codeword's bits (geometry-only — independent of codeword values). */
function buildPlacementPlan(rows: number, cols: number): { groups: [number, number][][]; corner: [number, number, number][]; zeroCells: [number, number][] } {
  const matrix: Cell[][] = Array.from({ length: rows }, () => new Array<Cell>(cols).fill(null));
  const record: [number, number][] = [];

  let row = 4;
  let col = 0;
  for (;;) {
    if (row === rows && col === 0) placeSpecial1(matrix, rows, cols, record);
    else if (row === rows - 2 && col === 0 && cols % 4 !== 0) placeSpecial2(matrix, rows, cols, record);
    else if (row === rows - 2 && col === 0 && cols % 8 === 4) placeSpecial3(matrix, rows, cols, record);
    else if (row === rows + 4 && col === 2 && cols % 8 === 0) placeSpecial4(matrix, rows, cols, record);

    for (;;) {
      if (row < rows && col >= 0 && matrix[row]![col] === null) placeStandardShape(matrix, rows, cols, row, col, record);
      row -= 2;
      col += 2;
      if (row < 0 || col >= cols) break;
    }
    row += 1;
    col += 3;

    for (;;) {
      if (row >= 0 && col < cols && matrix[row]![col] === null) placeStandardShape(matrix, rows, cols, row, col, record);
      row += 2;
      col -= 2;
      if (row >= rows || col < 0) break;
    }
    row += 3;
    col += 1;

    if (row >= rows && col >= cols) break;
  }

  const groups: [number, number][][] = [];
  for (let i = 0; i < record.length; i += 8) groups.push(record.slice(i, i + 8));

  const corner: [number, number, number][] = [];
  if (matrix[rows - 1]![cols - 1] === null) {
    corner.push([rows - 1, cols - 1, 1], [rows - 2, cols - 2, 1], [rows - 1, cols - 2, 0], [rows - 2, cols - 1, 0]);
    for (const [r, c, bit] of corner) matrix[r]![c] = bit;
  }

  const zeroCells: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (matrix[r]![c] === null) zeroCells.push([r, c]);

  return { groups, corner, zeroCells };
}

function placeCodewords(codewords: number[], rows: number, cols: number): boolean[][] {
  const { groups, corner, zeroCells } = buildPlacementPlan(rows, cols);
  const matrix: Cell[][] = Array.from({ length: rows }, () => new Array<Cell>(cols).fill(null));

  groups.forEach((cells, k) => {
    const codeword = codewords[k]!;
    cells.forEach(([r, c], bit) => {
      matrix[r]![c] = (codeword >> (7 - bit)) & 1;
    });
  });
  for (const [r, c, bit] of corner) matrix[r]![c] = bit;
  for (const [r, c] of zeroCells) matrix[r]![c] = 0;

  return matrix.map((row) => row.map((v) => v === 1));
}

/**
 * Overlays the per-region L-shaped finder pattern (solid border on the left/bottom, dashed on
 * the top/right) and the gaps between regions for multi-region symbols, producing the final
 * rendered grid (no quiet zone). Adjacent regions share their border: the 2-module gap between
 * them is one region's right/top border plus its neighbour's left/bottom border, not two
 * independent borders — getting that overlap right (rather than giving every region its own
 * full +2 border) is what this function is actually for.
 */
function addFinderPatterns(dataMatrix: boolean[][], regionRows: number, regionCols: number, hRegions: number, vRegions: number): boolean[][] {
  const gap = 1;
  const mappingWidth = dataMatrix[0]!.length;
  const gappedWidth = mappingWidth + (hRegions - 1) * gap * 2;

  // Splice a 2*gap blank gap between each pair of adjacent region rows/columns.
  const gapped: boolean[][] = [];
  for (let rowN = 0; rowN < dataMatrix.length; rowN++) {
    if (rowN > 0 && rowN % regionRows === 0) {
      for (let g = 0; g < gap * 2; g++) gapped.push(new Array<boolean>(gappedWidth).fill(false));
    }
    const newRow: boolean[] = [];
    for (let i = 0; i < hRegions; i++) {
      if (i > 0) newRow.push(...new Array<boolean>(gap * 2).fill(false));
      newRow.push(...dataMatrix[rowN]!.slice(i * regionCols, (i + 1) * regionCols));
    }
    gapped.push(newRow);
  }

  // Wrap in a `gap`-wide border ring — this ring is where the outermost regions' own finder
  // borders get drawn below, exactly like the inter-region gaps serve the inner regions.
  const blankRow = new Array<boolean>(gapped[0]!.length + 2 * gap).fill(false);
  const bordered: boolean[][] = [
    ...Array.from({ length: gap }, () => [...blankRow]),
    ...gapped.map((row) => [...new Array<boolean>(gap).fill(false), ...row, ...new Array<boolean>(gap).fill(false)]),
    ...Array.from({ length: gap }, () => [...blankRow]),
  ];

  for (let xIndex = 0; xIndex < hRegions; xIndex++) {
    for (let yIndex = 0; yIndex < vRegions; yIndex++) {
      const xOrigin = xIndex * (regionCols + 2);
      const yOrigin = yIndex * (regionRows + 2);
      const xMax = xOrigin + regionCols + 1;
      const yMax = yOrigin + regionRows + 1;

      for (let x = xOrigin; x < xMax; x++) bordered[yMax]![x] = true; // bottom solid border
      for (let y = yOrigin; y < yMax; y++) bordered[y]![xOrigin] = true; // left solid border
      for (let x = xOrigin; x < xMax; x += 2) bordered[yOrigin]![x] = true; // top dashed border
      for (let y = yMax; y > yOrigin; y -= 2) bordered[y]![xMax] = true; // right dashed border
    }
  }

  return bordered;
}

/** Encodes `data` as UTF-8 bytes (ASCII mode; non-ASCII bytes use Upper Shift) into the final Data Matrix module grid (`true` = dark), including finder patterns but no quiet zone. */
export function encodeDataMatrix(data: string, opts: DataMatrixOptions = {}): boolean[][] {
  const bytes = Buffer.from(data, 'utf8');
  const codewords = packAscii(bytes);

  const spec = selectSpec(codewords.length, opts.shape ?? 'auto');

  const padded = [...codewords];
  const padSize = spec.dataWords - codewords.length;
  if (padSize > 0) padded.push(129);
  for (let i = 1; i < padSize; i++) padded.push(randomisePad(codewords.length + i + 1));

  const ecPerBlock = spec.errorWords / spec.rsBlocks;
  const blocksData: number[][] = Array.from({ length: spec.rsBlocks }, (_, i) => padded.filter((_, idx) => idx % spec.rsBlocks === i));
  const blocksEc = blocksData.map((block) => GF256_DATAMATRIX.encode(block, ecPerBlock, 1));

  const finalCodewords = [...padded];
  for (let j = 0; j < ecPerBlock; j++) {
    for (let i = 0; i < spec.rsBlocks; i++) finalCodewords.push(blocksEc[i]![j]!);
  }

  const mappingRows = spec.regionRows * spec.vRegions;
  const mappingCols = spec.regionCols * spec.hRegions;
  const dataMatrix = placeCodewords(finalCodewords, mappingRows, mappingCols);
  return addFinderPatterns(dataMatrix, spec.regionRows, spec.regionCols, spec.hRegions, spec.vRegions);
}
