# node-lbx

Read, edit, and write Brother P-touch `.lbx` label files from Node/TypeScript.

An `.lbx` file is a ZIP archive containing `label.xml` (the layout) plus `prop.xml` and any embedded images. This library parses it into a typed object model so you can find placeholder objects designed in P-touch Editor and fill them with real data (e.g. from a database), then write a new `.lbx`.

## Install

```sh
npm install
npm run build
```

## Template-fill workflow (primary use case)

Design a label visually in P-touch Editor, naming the objects you want to fill (`Right click -> Name Object`). Then:

```ts
import { LbxDocument } from 'node-lbx';

const doc = LbxDocument.load('template.lbx');

doc.findObjectByName('PRODUCT_NAME')?.setText(product.name);
doc.findObjectByName('PRODUCT_BARCODE')?.setData(product.sku);
doc.findObjectByName('PRODUCT_IMAGE')?.setImage(product.imageBuffer);

doc.save('output.lbx');
```

`findObjectByName` searches nested `pt:group` objects too. `findObjectsByName` returns every match (an `objectName` can repeat, e.g. once at top level and once inside a group).

## Object types

- `TextObject` — `.text`, `.setText(value, { preserveRuns? })`, `.getRuns()`/`.setRuns()`, `.font`
- `ImageObject` — `.fileName`, `.getImageBuffer()`, `.setImage(bufferOrPath)`
- `BarcodeObject` — `.data`, `.setData(value)`, `.protocol`
- `TableObject` — `.rows`, `.columns`, `.getCell(x, y).textObject`
- `GroupObject` — `.getObjects()`, `.findObjectByName(name)`
- Every object also exposes `.x`/`.y`/`.width`/`.height`/`.angle` (accepting `pt`/`mm`/`in` input) and `.element` as an escape hatch to the raw DOM node for anything not yet modeled (`draw:*`, `cable:*`).

## Building a label from scratch

```ts
import { LbxDocument } from 'node-lbx';

const doc = LbxDocument.create({ width: '24mm', height: '60mm' });
doc.addText({ x: 4, y: 4, width: 150, height: 20, text: 'Hello', objectName: 'GREETING' });
doc.addImage({ x: 4, y: 28, width: 40, height: 40, fileName: 'icon.bmp', data: iconBuffer });
doc.save('output.lbx');
```

## Previewing a label

Render any `.lbx` to SVG to see the layout without opening P-touch Editor:

```ts
import { LbxDocument, renderToSvg } from 'node-lbx';

const doc = LbxDocument.load('label.lbx');
const svg = renderToSvg(doc); // 1 SVG user unit = 1pt, same coordinate space as label.xml
```

Or from the command line, which writes a standalone HTML preview and opens it in your browser:

```sh
npx tsx examples/preview.ts path/to/label.lbx   # add --no-open to just write the file
```

This is a layout approximation, not pixel-exact P-touch Editor output: text uses whatever fonts are installed in the browser rendering the SVG, and unmodeled object types (`draw:*`, `image:clipart`, `cable:*`) show as a labeled placeholder box. 32bpp BMP images (P-touch's usual export format) are converted to PNG so their alpha channel — which P-touch hides in a byte the BMP spec doesn't define as alpha — renders as real transparency instead of a solid block.

### Barcode protocol support

Real encoders — not a schematic placeholder — for every protocol in P-touch Editor's barcode dropdown except one:

- **Linear**: `CODE128`, `CODE39`, `CODABAR`/`NW-7`, `ITF` (Interleaved 2 of 5), `EAN-13`/`JAN-13`, `EAN-8`/`JAN-8`, `UPC-A`, `UPC-E`, `GS1-128`/`UCC-EAN128`, `ISBN-2`/`ISBN-5` (EAN-13 + a 2- or 5-digit supplement)
- **Postal**: `POSTNET`, USPS Intelligent Mail (`Intelligent Mail-barcode`/OneCode)
- **2D**: `QR Code`, `Data Matrix` (ECC200, all 24 square + all 6 rectangular sizes), `PDF417` (standard, Truncated/Compact, and MicroPDF417 — see `barcode:pdf417Style model=`)
- **GS1 DataBar** (`GS2 DataBar(RSS)` in the P-touch menu — almost certainly a typo for GS1): the Omnidirectional/Truncated variant
- **MaxiCode**: Mode 4 (general/unstructured) only; Modes 2/3's structured postal primary message and Mode 5's enhanced error correction aren't implemented

`Laser-barcode` isn't implemented — it's not a symbology with any findable public specification, so it stays on the schematic fallback.

**Verification tiers**, from strongest to weakest confidence:
- **Decoded by a real scanner** (`zbar`, `pylibdmtx`, or `zxing-cpp`, whichever actually supports the format): CODE128, CODE39, CODABAR, ITF, EAN-13/8, UPC-A/E, GS1-128, QR Code, Data Matrix, PDF417, GS1 DataBar
- **Bit-for-bit or structurally matched against a reference encoder** (`python-barcode`, or BWIPP via `treepoem`+Ghostscript) but not independently re-decoded, because no local decoder supports the format: POSTNET (self-consistent round-trip against its own reverse table), USPS Intelligent Mail (matched against BWIPP pixel-for-pixel)
- **Data encoding verified by careful reference-implementation port + self-consistency round-trip, but the rendered image's real-world scannability is unconfirmed**: MaxiCode — its codeword generation was checked character-by-character against its own symbol-value tables, but the hexagonal dot-grid rendering geometry isn't confirmed to match what a real MaxiCode reader expects

`CODE128` and `GS1-128` encode in Set B only (every character costs a fixed 8 modules); `QR Code` uses byte mode only; `Data Matrix` uses ASCII mode only (digit pairs still compact); `PDF417` (all three variants) uses Byte Compaction only. All four are always correct and scannable, just not always the most compact symbol possible — the same tradeoff throughout this renderer, favoring "always right" over "sometimes smaller."

`PDF417`'s three variants (real scanners confirmed all three, MicroPDF417 identified by format and content): `standard` is the full symbol; `truncate` (a.k.a. Compact PDF417) is identical data/error-correction, just narrower — it drops the right row indicator's bars and shrinks the stop pattern to one module; `micro` is MicroPDF417, a related but distinct symbology with its own row layout and fixed size table (column count is always auto-selected). Error correction level (`eccLevel`) is read from the file for `standard`/`truncate` when explicitly set (not `auto`); MicroPDF417's error correction is fixed by its size table and isn't independently selectable.

`Data Matrix` picks a symbol size via `renderToSvg`'s underlying `encodeDataMatrix(data, { shape })`: `'auto'` (the default) picks whichever fitting size — square or rectangular — has the smallest rendered area, preferring square on a tie; `'square'` or `'rectangular'` pin it to that family. In practice ECC200's rectangular sizes are never smaller-area than the nearest square for the same capacity, so `'auto'` picks square unless you ask for `'rectangular'` explicitly (useful for a label shape too narrow for a square symbol).

### Previewing a filled label

To see the *filled* label rather than the empty template, fill placeholders first (same `objectName` lookup as `findObjectByName`) and render the result:

```ts
import { LbxDocument, fillPlaceholders, renderToSvg } from 'node-lbx';

const doc = LbxDocument.load('template.lbx');
fillPlaceholders(doc, {
  PRODUCT_NAME: 'Widget',
  PRODUCT_BARCODE: '9781234567897',
  PRODUCT_IMAGE: 'photo.png', // path to read bytes from (or pass a Buffer)
});
const svg = renderToSvg(doc);
```

Or from the CLI with a JSON data file:

```sh
npx tsx examples/preview.ts template.lbx --data data.json
```

```json
{ "PRODUCT_NAME": "Widget", "PRODUCT_BARCODE": "9781234567897", "PRODUCT_IMAGE": "./photo.png" }
```

## Compatibility notes

P-touch Editor is strict about `label.xml`: element order within an object matters, and a text object's `pt:data` string length must equal the sum of its `text:stringItem[@charLen]` runs. This library preserves both automatically for anything it doesn't touch, and keeps `charLen` correct when you call `setText`/`setRuns`. `save()` never rewrites `prop.xml` unless you call `getMetadata()` and mutate it.

Two things aren't fully verified against real P-touch Editor behavior yet (see `scripts/manual-check.ts` and the plan's open risks): `charLen` semantics for non-ASCII text, and whether `image:orgPos` should track or freeze on resize.

## Tests

`test/fixtures/*.lbx` are generated, not committed (see `test/fixtures/generate.ts` — everything in there is synthetic placeholder content, safe to regenerate anywhere).

```sh
npm test          # regenerates fixtures (pretest), then runs round-trip / unit tests
npx tsx scripts/manual-check.ts   # writes manual-check/*.lbx for opening in P-touch Editor (also gitignored)
```
