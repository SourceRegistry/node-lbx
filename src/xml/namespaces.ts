export const NS = {
  pt: 'http://schemas.brother.info/ptouch/2007/lbx/main',
  style: 'http://schemas.brother.info/ptouch/2007/lbx/style',
  text: 'http://schemas.brother.info/ptouch/2007/lbx/text',
  draw: 'http://schemas.brother.info/ptouch/2007/lbx/draw',
  image: 'http://schemas.brother.info/ptouch/2007/lbx/image',
  barcode: 'http://schemas.brother.info/ptouch/2007/lbx/barcode',
  database: 'http://schemas.brother.info/ptouch/2007/lbx/database',
  table: 'http://schemas.brother.info/ptouch/2007/lbx/table',
  cable: 'http://schemas.brother.info/ptouch/2007/lbx/cable',
  meta: 'http://schemas.brother.info/ptouch/2007/lbx/meta',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
} as const;

export type NsPrefix = keyof typeof NS;

/** Object-tag -> owning namespace prefix, for every direct child of pt:objects we recognize. */
export const OBJECT_TAGS: Record<string, NsPrefix> = {
  text: 'text',
  datetime: 'text',
  image: 'image',
  clipart: 'image',
  barcode: 'barcode',
  table: 'table',
  group: 'pt',
  frame: 'draw',
  symbol: 'draw',
  poly: 'draw',
};
