/** A length in points (1pt = 1/72in), branded so raw numbers can't be passed where a normalized Length is expected. */
export type Length = number & { readonly __unit: 'pt' };

export type LengthInput =
  | number
  | string
  | { mm: number }
  | { in: number }
  | { pt: number };

const MM_TO_PT = 2.834645669;
const IN_TO_PT = 72;

function asLength(value: number): Length {
  return value as Length;
}

/** Normalizes any supported length input (plain number, "12pt"/"10mm"/"1in" string, or {mm|in|pt}) to points. */
export function toPt(input: LengthInput): Length {
  if (typeof input === 'number') return asLength(input);

  if (typeof input === 'string') {
    const match = /^(-?[\d.]+)\s*(pt|mm|in)?$/i.exec(input.trim());
    if (!match) throw new Error(`node-lbx: unrecognized length "${input}"`);
    const value = parseFloat(match[1]!);
    const unit = (match[2] ?? 'pt').toLowerCase();
    if (unit === 'mm') return asLength(value * MM_TO_PT);
    if (unit === 'in') return asLength(value * IN_TO_PT);
    return asLength(value);
  }

  if ('pt' in input) return asLength(input.pt);
  if ('mm' in input) return asLength(input.mm * MM_TO_PT);
  if ('in' in input) return asLength(input.in * IN_TO_PT);

  throw new Error('node-lbx: unrecognized length input');
}

/** Formats a point value the way Brother's XML does: minimal decimals, "pt" suffix. */
export function formatPt(value: Length | number): string {
  const rounded = parseFloat(value.toFixed(6));
  return `${rounded}pt`;
}

/** Parses a Brother "N.NNpt" attribute value into a Length. Returns 0pt for empty/missing attributes. */
export function parsePt(raw: string | null | undefined): Length {
  if (!raw) return asLength(0);
  return toPt(raw);
}

export function ptToMm(value: Length | number): number {
  return value / MM_TO_PT;
}

export function ptToIn(value: Length | number): number {
  return value / IN_TO_PT;
}
