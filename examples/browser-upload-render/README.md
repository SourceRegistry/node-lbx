# browser-upload-render

Local dev server: drop an `.lbx` file in the browser, it's parsed and rendered to SVG server-side
and shown instantly. No build step, no dependencies beyond `node-lbx` itself (plain `node:http`).

```sh
npx tsx examples/browser-upload-render/server.ts        # http://localhost:8787
npx tsx examples/browser-upload-render/server.ts 3000    # custom port
```

Then open the printed URL and drop/select a `.lbx` file.

This is an example, not a hardened upload endpoint — it has no auth and holds each upload fully in
memory (capped at 10MB); don't expose it beyond localhost.
