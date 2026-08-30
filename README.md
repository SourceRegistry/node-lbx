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

## Compatibility notes

P-touch Editor is strict about `label.xml`: element order within an object matters, and a text object's `pt:data` string length must equal the sum of its `text:stringItem[@charLen]` runs. This library preserves both automatically for anything it doesn't touch, and keeps `charLen` correct when you call `setText`/`setRuns`. `save()` never rewrites `prop.xml` unless you call `getMetadata()` and mutate it.

Two things aren't fully verified against real P-touch Editor behavior yet (see `scripts/manual-check.ts` and the plan's open risks): `charLen` semantics for non-ASCII text, and whether `image:orgPos` should track or freeze on resize.

## Tests

`test/fixtures/*.lbx` are generated, not committed (see `test/fixtures/generate.ts` — everything in there is synthetic placeholder content, safe to regenerate anywhere).

```sh
npm test          # regenerates fixtures (pretest), then runs round-trip / unit tests
npx tsx scripts/manual-check.ts   # writes manual-check/*.lbx for opening in P-touch Editor (also gitignored)
```
