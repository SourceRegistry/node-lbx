/**
 * Minimal example server: upload an .lbx file in the browser, see it rendered instantly.
 * No dependencies beyond node-lbx itself — plain node:http, raw binary upload via fetch (no
 * multipart parsing needed since the browser posts the file body directly).
 *
 * Usage: npx tsx examples/browser-upload-render/server.ts [port]
 */
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LbxDocument } from '../../src/document.js';
import { renderToSvg } from '../../src/render/svg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(path.join(__dirname, 'index.html'));

const PORT = Number(process.argv[2]) || 8787;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        req.destroy();
        reject(new Error('file too large (max 10MB)'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(indexHtml);
    return;
  }

  if (req.method === 'POST' && req.url === '/render') {
    try {
      const body = await readBody(req);
      const doc = LbxDocument.load(body);
      const svg = renderToSvg(doc, { padding: 8 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ svg }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`lbx upload preview: http://localhost:${PORT}`);
});
