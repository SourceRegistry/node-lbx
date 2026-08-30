import type { Document, Element } from '@xmldom/xmldom';
import { NS, type NsPrefix } from './namespaces.js';

export function qualifiedName(prefix: NsPrefix, localName: string): string {
  return `${prefix}:${localName}`;
}

/** Creates a namespaced element (not yet attached to the tree). */
export function createElementNS(doc: Document, prefix: NsPrefix, localName: string): Element {
  return doc.createElementNS(NS[prefix], qualifiedName(prefix, localName));
}

/** First direct child element matching namespace + local name, in document order. */
export function getChildNS(parent: Element, ns: string, localName: string): Element | undefined {
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children.item(i);
    if (node && node.nodeType === 1) {
      const el = node as unknown as Element;
      if (el.namespaceURI === ns && el.localName === localName) return el;
    }
  }
  return undefined;
}

/** All direct child elements matching namespace (and optionally local name), in document order. */
export function getChildrenNS(parent: Element, ns: string, localName?: string): Element[] {
  const result: Element[] = [];
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children.item(i);
    if (node && node.nodeType === 1) {
      const el = node as unknown as Element;
      if (el.namespaceURI === ns && (localName === undefined || el.localName === localName)) {
        result.push(el);
      }
    }
  }
  return result;
}

/** All direct child elements, regardless of namespace, in document order. */
export function getChildElements(parent: Element): Element[] {
  const result: Element[] = [];
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children.item(i);
    if (node && node.nodeType === 1) result.push(node as unknown as Element);
  }
  return result;
}

/** Sets an element's text content to a single text node, replacing any existing children. */
export function setTextContent(doc: Document, el: Element, text: string): void {
  while (el.firstChild) el.removeChild(el.firstChild);
  el.appendChild(doc.createTextNode(text));
}

/** Concatenated text of all direct text-node children (mirrors DOM textContent for leaf elements). */
export function getTextContent(el: Element): string {
  let text = '';
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children.item(i);
    if (node && node.nodeType === 3) text += node.nodeValue ?? '';
  }
  return text;
}

/** Removes all direct child elements matching namespace + local name. */
export function removeChildrenNS(parent: Element, ns: string, localName: string): void {
  for (const el of getChildrenNS(parent, ns, localName)) {
    parent.removeChild(el);
  }
}
