# browser-render

Drop an `.lbx` file in the browser and render it to SVG entirely client-side. The file never leaves
the browser.

```sh
npm run build
npx vite
```

Open `http://localhost:5173/examples/browser-render/`, then drop or select an `.lbx` file. Vite only
serves static assets; parsing and rendering happen in the client.

The example uses a relative URL (`../../dist/browser.js`) because native browsers cannot resolve
bare npm specifiers. In an application processed by Vite, Webpack, Parcel, or another bundler, use:

```js
import { renderLbxToSvg } from '@sourceregistry/node-lbx/browser';
```
