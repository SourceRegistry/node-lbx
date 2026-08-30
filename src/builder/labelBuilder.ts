import type { Document, Element } from '@xmldom/xmldom';
import { createElementNS, setTextContent } from '../xml/dom.js';
import { toPt, formatPt } from '../units.js';
import type { LengthInput } from '../units.js';
import { createObjectStyleEl } from './templates.js';

export interface CreateTextOptions {
  x: LengthInput;
  y: LengthInput;
  width: LengthInput;
  height: LengthInput;
  text: string;
  objectName?: string;
  fontName?: string;
  fontSize?: LengthInput;
}

/** Builds a standalone text:text element (not yet attached to a document). */
export function createTextElement(document: Document, opts: CreateTextOptions): Element {
  const el = createElementNS(document, 'text', 'text');
  el.appendChild(createObjectStyleEl(document, opts));

  const size = toPt(opts.fontSize ?? 10);
  const fontInfo = buildFontInfo(document, opts.fontName ?? 'Helsinki', size);
  el.appendChild(fontInfo);

  const control = createElementNS(document, 'text', 'textControl');
  control.setAttribute('control', 'LONGTEXTFIXED');
  control.setAttribute('clipFrame', 'false');
  control.setAttribute('aspectNormal', 'true');
  control.setAttribute('shrink', 'true');
  control.setAttribute('autoLF', 'true');
  control.setAttribute('avoidImage', 'false');
  el.appendChild(control);

  const align = createElementNS(document, 'text', 'textAlign');
  align.setAttribute('horizontalAlignment', 'LEFT');
  align.setAttribute('verticalAlignment', 'TOP');
  align.setAttribute('inLineAlignment', 'BASELINE');
  el.appendChild(align);

  const style = createElementNS(document, 'text', 'textStyle');
  style.setAttribute('vertical', 'false');
  style.setAttribute('nullBlock', 'false');
  style.setAttribute('charSpace', '0');
  style.setAttribute('lineSpace', '0');
  style.setAttribute('orgPoint', formatPt(size));
  style.setAttribute('combinedChars', 'false');
  el.appendChild(style);

  const data = createElementNS(document, 'pt', 'data');
  setTextContent(document, data, opts.text);
  el.appendChild(data);

  const run = createElementNS(document, 'text', 'stringItem');
  run.setAttribute('charLen', String(opts.text.length));
  run.appendChild(buildFontInfo(document, opts.fontName ?? 'Helsinki', size));
  el.appendChild(run);

  return el;
}

function buildFontInfo(document: Document, name: string, size: import('../units.js').Length): Element {
  const fontInfo = createElementNS(document, 'text', 'ptFontInfo');

  const logFont = createElementNS(document, 'text', 'logFont');
  logFont.setAttribute('name', name);
  logFont.setAttribute('width', '0');
  logFont.setAttribute('italic', 'false');
  logFont.setAttribute('weight', '400');
  logFont.setAttribute('charSet', '0');
  logFont.setAttribute('pitchAndFamily', '2');
  fontInfo.appendChild(logFont);

  const fontExt = createElementNS(document, 'text', 'fontExt');
  fontExt.setAttribute('effect', 'NOEFFECT');
  fontExt.setAttribute('underline', '0');
  fontExt.setAttribute('strikeout', '0');
  fontExt.setAttribute('size', formatPt(size));
  fontExt.setAttribute('orgSize', formatPt(toPt(size * 3.6)));
  fontExt.setAttribute('textColor', '#000000');
  fontExt.setAttribute('textPrintColorNumber', '1');
  fontInfo.appendChild(fontExt);

  return fontInfo;
}

export interface CreateImageOptions {
  x: LengthInput;
  y: LengthInput;
  width: LengthInput;
  height: LengthInput;
  fileName: string;
  originalName?: string;
  objectName?: string;
}

/** Builds a standalone image:image element (not yet attached to a document; caller writes the bytes to the archive). */
export function createImageElement(document: Document, opts: CreateImageOptions): Element {
  const el = createElementNS(document, 'image', 'image');
  el.appendChild(createObjectStyleEl(document, opts));

  const imageStyle = createElementNS(document, 'image', 'imageStyle');
  imageStyle.setAttribute('originalName', opts.originalName ?? opts.fileName);
  imageStyle.setAttribute('alignInText', 'NONE');
  imageStyle.setAttribute('firstMerge', 'true');
  imageStyle.setAttribute('IpName', '');
  imageStyle.setAttribute('fileName', opts.fileName);

  const transparent = createElementNS(document, 'image', 'transparent');
  transparent.setAttribute('flag', 'false');
  transparent.setAttribute('color', '#FFFFFF');
  imageStyle.appendChild(transparent);

  const trimming = createElementNS(document, 'image', 'trimming');
  trimming.setAttribute('flag', 'false');
  trimming.setAttribute('shape', 'RECTANGLE');
  trimming.setAttribute('trimOrgX', '0pt');
  trimming.setAttribute('trimOrgY', '0pt');
  trimming.setAttribute('trimOrgWidth', '0pt');
  trimming.setAttribute('trimOrgHeight', '0pt');
  imageStyle.appendChild(trimming);

  const orgPos = createElementNS(document, 'image', 'orgPos');
  orgPos.setAttribute('x', formatPt(toPt(opts.x)));
  orgPos.setAttribute('y', formatPt(toPt(opts.y)));
  orgPos.setAttribute('width', formatPt(toPt(opts.width)));
  orgPos.setAttribute('height', formatPt(toPt(opts.height)));
  imageStyle.appendChild(orgPos);

  const effect = createElementNS(document, 'image', 'effect');
  effect.setAttribute('effect', 'NONE');
  effect.setAttribute('brightness', '50');
  effect.setAttribute('contrast', '50');
  effect.setAttribute('photoIndex', '4');
  imageStyle.appendChild(effect);

  const mono = createElementNS(document, 'image', 'mono');
  mono.setAttribute('operationKind', 'ERRORDIFFUSION');
  mono.setAttribute('reverse', '0');
  mono.setAttribute('ditherKind', 'MESH');
  mono.setAttribute('threshold', '128');
  mono.setAttribute('gamma', '100');
  mono.setAttribute('ditherEdge', '0');
  mono.setAttribute('rgbconvProportionRed', '30');
  mono.setAttribute('rgbconvProportionGreen', '59');
  mono.setAttribute('rgbconvProportionBlue', '11');
  mono.setAttribute('rgbconvProportionReversed', '0');
  imageStyle.appendChild(mono);

  el.appendChild(imageStyle);
  return el;
}
