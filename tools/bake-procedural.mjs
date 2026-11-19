// Hornea las texturas procedurales caras de src/textures.js (madera cruda 1024², puente 512²) a public/tex.
// Requiere vite en :5173.  node tools/bake-procedural.mjs  &&  python tools/optimize-assets.py
import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'commit' });
await p.waitForFunction(() => document.readyState !== 'loading');
const out = await p.evaluate(async () => {
  const m = await import('/src/textures.js');
  return { raw: m.rawWoodTexture().image.toDataURL('image/png'), bridge: m.bridgeTexture().image.toDataURL('image/png') };
});
for (const [k, u] of Object.entries(out)) { const f = `public/tex/${k}.png`; fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); console.log(f, fs.statSync(f).size); }
await b.close();
