import { DOMImplementation } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import { NS } from '../xml/namespaces.js';
import { createElementNS, setTextContent } from '../xml/dom.js';
import { toPt, formatPt } from '../units.js';
import type { PaperOptions } from '../style.js';

const XMLNS = 'http://www.w3.org/2000/xmlns/';

/** Builds a fresh label.xml skeleton (pt:document > pt:body > style:sheet > paper/cutLine/backGround/objects). */
export function createDocumentSkeleton(paper: PaperOptions): { document: Document; objectsEl: Element } {
  const impl = new DOMImplementation();
  const document = impl.createDocument(NS.pt, 'pt:document', null) as unknown as Document;
  const root = document.documentElement as unknown as Element;

  for (const [prefix, uri] of Object.entries(NS)) {
    root.setAttributeNS(XMLNS, `xmlns:${prefix}`, uri);
  }
  root.setAttribute('version', '1.9');
  root.setAttribute('generator', 'node-lbx');

  const body = createElementNS(document, 'pt', 'body');
  body.setAttribute('currentSheet', 'Sheet 1');
  body.setAttribute('direction', 'LTR');
  root.appendChild(body);

  const sheet = createElementNS(document, 'style', 'sheet');
  sheet.setAttribute('name', 'Sheet 1');
  body.appendChild(sheet);

  const width = toPt(paper.width);
  const height = toPt(paper.height);

  const paperEl = createElementNS(document, 'style', 'paper');
  paperEl.setAttribute('media', '0');
  paperEl.setAttribute('width', formatPt(width));
  paperEl.setAttribute('height', formatPt(height));
  paperEl.setAttribute('marginLeft', formatPt(toPt(paper.marginLeft ?? 0)));
  paperEl.setAttribute('marginTop', formatPt(toPt(paper.marginTop ?? 0)));
  paperEl.setAttribute('marginRight', formatPt(toPt(paper.marginRight ?? 0)));
  paperEl.setAttribute('marginBottom', formatPt(toPt(paper.marginBottom ?? 0)));
  paperEl.setAttribute('orientation', paper.orientation ?? 'landscape');
  paperEl.setAttribute('autoLength', String(paper.autoLength ?? false));
  paperEl.setAttribute('monochromeDisplay', 'true');
  paperEl.setAttribute('printColorDisplay', 'false');
  paperEl.setAttribute('printColorsID', '0');
  paperEl.setAttribute('paperColor', '#FFFFFF');
  paperEl.setAttribute('paperInk', '#000000');
  paperEl.setAttribute('split', '1');
  paperEl.setAttribute('format', '259');
  paperEl.setAttribute('backgroundTheme', '0');
  sheet.appendChild(paperEl);

  const cutLine = createElementNS(document, 'style', 'cutLine');
  cutLine.setAttribute('regularCut', '0pt');
  cutLine.setAttribute('freeCut', '');
  sheet.appendChild(cutLine);

  const backGround = createElementNS(document, 'style', 'backGround');
  backGround.setAttribute('x', '0pt');
  backGround.setAttribute('y', '0pt');
  backGround.setAttribute('width', formatPt(width));
  backGround.setAttribute('height', formatPt(height));
  backGround.setAttribute('brushStyle', 'NULL');
  backGround.setAttribute('brushId', '0');
  backGround.setAttribute('userPattern', 'NONE');
  backGround.setAttribute('userPatternId', '0');
  backGround.setAttribute('color', '#000000');
  backGround.setAttribute('printColorNumber', '1');
  backGround.setAttribute('backColor', '#FFFFFF');
  backGround.setAttribute('backPrintColorNumber', '0');
  sheet.appendChild(backGround);

  const objectsEl = createElementNS(document, 'pt', 'objects');
  sheet.appendChild(objectsEl);

  return { document, objectsEl };
}

export interface ObjectStyleOptions {
  x: import('../units.js').LengthInput;
  y: import('../units.js').LengthInput;
  width: import('../units.js').LengthInput;
  height: import('../units.js').LengthInput;
  objectName?: string;
}

/** Builds the pt:objectStyle (+pen/brush/expanded) block shared by every label object type. */
export function createObjectStyleEl(document: Document, opts: ObjectStyleOptions): Element {
  const style = createElementNS(document, 'pt', 'objectStyle');
  style.setAttribute('x', formatPt(toPt(opts.x)));
  style.setAttribute('y', formatPt(toPt(opts.y)));
  style.setAttribute('width', formatPt(toPt(opts.width)));
  style.setAttribute('height', formatPt(toPt(opts.height)));
  style.setAttribute('backColor', '#FFFFFF');
  style.setAttribute('backPrintColorNumber', '0');
  style.setAttribute('ropMode', 'COPYPEN');
  style.setAttribute('angle', '0');
  style.setAttribute('anchor', 'TOPLEFT');
  style.setAttribute('flip', 'NONE');

  const pen = createElementNS(document, 'pt', 'pen');
  pen.setAttribute('style', 'NULL');
  pen.setAttribute('widthX', '0.5pt');
  pen.setAttribute('widthY', '0.5pt');
  pen.setAttribute('color', '#000000');
  pen.setAttribute('printColorNumber', '1');
  style.appendChild(pen);

  const brush = createElementNS(document, 'pt', 'brush');
  brush.setAttribute('style', 'NULL');
  brush.setAttribute('color', '#000000');
  brush.setAttribute('printColorNumber', '1');
  brush.setAttribute('id', '0');
  style.appendChild(brush);

  const expanded = createElementNS(document, 'pt', 'expanded');
  expanded.setAttribute('objectName', opts.objectName ?? '');
  expanded.setAttribute('ID', '0');
  expanded.setAttribute('lock', '0');
  expanded.setAttribute('templateMergeTarget', 'LABELLIST');
  expanded.setAttribute('templateMergeType', 'NONE');
  expanded.setAttribute('templateMergeID', '0');
  expanded.setAttribute('linkStatus', 'NONE');
  expanded.setAttribute('linkID', '0');
  style.appendChild(expanded);

  return style;
}

/** Builds a fresh prop.xml skeleton with empty Dublin Core fields. */
export function createPropSkeleton(): Document {
  const impl = new DOMImplementation();
  const document = impl.createDocument(NS.meta, 'meta:properties', null) as unknown as Document;
  const root = document.documentElement as unknown as Element;
  root.setAttributeNS(XMLNS, 'xmlns:meta', NS.meta);
  root.setAttributeNS(XMLNS, 'xmlns:dc', NS.dc);
  root.setAttributeNS(XMLNS, 'xmlns:dcterms', NS.dcterms);

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  const fields: Array<[keyof typeof NS, string, string]> = [
    ['meta', 'appName', 'node-lbx'],
    ['dc', 'title', ''],
    ['dc', 'subject', ''],
    ['dc', 'creator', ''],
    ['meta', 'keyword', ''],
    ['dc', 'description', ''],
    ['meta', 'template', ''],
    ['dcterms', 'created', now],
    ['dcterms', 'modified', now],
    ['meta', 'lastPrinted', ''],
    ['meta', 'modifiedBy', ''],
    ['meta', 'revision', '1'],
    ['meta', 'editTime', '0'],
    ['meta', 'numPages', '1'],
    ['meta', 'numWords', '0'],
    ['meta', 'numChars', '0'],
    ['meta', 'security', '0'],
    ['meta', 'transferScript', ''],
  ];

  for (const [prefix, local, value] of fields) {
    const el = createElementNS(document, prefix, local);
    setTextContent(document, el, value);
    root.appendChild(el);
  }

  return document;
}
