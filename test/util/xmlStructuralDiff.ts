import type { Element } from '@xmldom/xmldom';

function attrMap(el: Element): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes.item(i)!;
    map.set(attr.name, attr.value);
  }
  return map;
}

function elementChildren(node: Element): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const n = node.childNodes.item(i);
    if (n && n.nodeType === 1) result.push(n as unknown as Element);
  }
  return result;
}

function textOf(node: Element): string {
  let text = '';
  for (let i = 0; i < node.childNodes.length; i++) {
    const n = node.childNodes.item(i);
    if (n && n.nodeType === 3) text += n.nodeValue ?? '';
  }
  return text;
}

/**
 * Recursively compares two elements: tag name, attribute set (order-independent), text content,
 * and child element order/structure (order-sensitive — this is the load-bearing check for the
 * "P-touch Editor cares about element order" invariant).
 */
export function diffElements(a: Element, b: Element, path?: string): string[] {
  const here = path ?? a.tagName;
  const diffs: string[] = [];

  if (a.tagName !== b.tagName) {
    return [`${here}: tag mismatch "${a.tagName}" vs "${b.tagName}"`];
  }

  const attrsA = attrMap(a);
  const attrsB = attrMap(b);
  for (const [k, v] of attrsA) {
    if (!attrsB.has(k)) diffs.push(`${here}: missing attribute "${k}" in second doc`);
    else if (attrsB.get(k) !== v) diffs.push(`${here}: attribute "${k}" differs ("${v}" vs "${attrsB.get(k)}")`);
  }
  for (const k of attrsB.keys()) {
    if (!attrsA.has(k)) diffs.push(`${here}: extra attribute "${k}" in second doc`);
  }

  const textA = textOf(a).trim();
  const textB = textOf(b).trim();
  if (textA !== textB) diffs.push(`${here}: text differs ("${textA}" vs "${textB}")`);

  const childrenA = elementChildren(a);
  const childrenB = elementChildren(b);
  if (childrenA.length !== childrenB.length) {
    diffs.push(`${here}: child element count differs (${childrenA.length} vs ${childrenB.length})`);
  }
  const len = Math.min(childrenA.length, childrenB.length);
  for (let i = 0; i < len; i++) {
    diffs.push(...diffElements(childrenA[i]!, childrenB[i]!, `${here}/${childrenA[i]!.tagName}[${i}]`));
  }
  return diffs;
}
