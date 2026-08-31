/**
 * Codabar (NW-7) encoder. Table ported from JsBarcode's `codabar` module (MIT licensed) —
 * per-module bar/space bit strings ('1' = black module, '0' = white module).
 */
const CODES: Readonly<Record<string, string>> = {
  '0': '101010011', '1': '101011001', '2': '101001011', '3': '110010101', '4': '101101001',
  '5': '110101001', '6': '100101011', '7': '100101101', '8': '100110101', '9': '110100101',
  '-': '101001101', $: '101100101', ':': '1101011011', '/': '1101101011', '.': '1101101101',
  '+': '1011011011', A: '1011001001', B: '1001001011', C: '1010010011', D: '1010011001',
};

const GAP = '0';

/**
 * Encodes `data` as a Codabar module bit string, no quiet zone. `data` must start and end with
 * one of A/B/C/D (the start/stop characters); throws otherwise, or on any other unsupported
 * character (Codabar's data charset is 0-9 and `-$:/.+`).
 */
export function encodeCodabar(data: string): string {
  const upper = data.toUpperCase();
  if (!/^[A-D][0-9\-$:/.+]*[A-D]$/.test(upper)) {
    throw new Error('node-lbx: Codabar data must start and end with A/B/C/D and contain only 0-9 and -$:/.+ in between');
  }

  const parts: string[] = [];
  for (const ch of upper) {
    const code = CODES[ch];
    if (!code) throw new Error(`node-lbx: character ${JSON.stringify(ch)} is outside Codabar's symbol set`);
    parts.push(code);
  }
  return parts.join(GAP);
}
